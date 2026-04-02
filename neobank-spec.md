# 🏦 SolBank — Neobank On-Chain em Solana/Anchor

## Documento Unificado: PRD + TDD + Spec

---

# PARTE 1 — PRD (Product Requirements Document)

## 1.1 Visão Geral

**SolBank** é um programa Anchor na Solana que simula uma conta bancária on-chain. Permite que qualquer usuário crie sua própria "conta bancária" (PDA), deposite SOL ou tokens SPL, consulte saldo e faça saques — tudo com controle de acesso onde apenas o dono da conta pode operar.

## 1.2 Problema

Usuários precisam de um mecanismo simples e seguro para custodiar fundos on-chain com operações básicas de banking (depósito, saque, consulta) sem depender de intermediários centralizados.

## 1.3 Público-Alvo

Desenvolvedores e usuários familiarizados com wallets Solana que desejam uma conta bancária programável on-chain.

## 1.4 Funcionalidades (MVP)

| ID | Feature | Descrição | Prioridade |
|----|---------|-----------|------------|
| F1 | Criar Conta | Usuário inicializa sua conta bancária (PDA) | Must |
| F2 | Depositar SOL | Transferir SOL nativo para a vault da conta | Must |
| F3 | Sacar SOL | Retirar SOL da vault para a wallet do dono | Must |
| F4 | Depositar SPL Token | Transferir tokens SPL para a token account da vault | Must |
| F5 | Sacar SPL Token | Retirar tokens SPL da vault para o dono | Must |
| F6 | Consultar Saldo | Ler estado on-chain da conta (SOL + metadata) | Must |
| F7 | Fechar Conta | Encerrar a conta e devolver rent ao dono | Should |

## 1.5 Requisitos Não-Funcionais

- Deploy funcional na **devnet**
- Testes automatizados com `anchor test`
- README documentado para outro dev reproduzir
- Controle de acesso: somente o `owner` opera na sua conta

## 1.6 Fora de Escopo (MVP)

- Multisig / múltiplos signatários
- Yield / staking integrado
- Frontend / UI
- Histórico de transações on-chain (logs são suficientes)
- Suporte a múltiplos tokens SPL na mesma conta (1 token por vault SPL)

## 1.7 Critérios de Sucesso (mapeados à avaliação)

| Critério do Desafio | Como atendemos |
|---------------------|----------------|
| Compila e deploya na devnet | CI local + deploy script documentado |
| Instruções principais funcionam | deposit_sol, withdraw_sol, deposit_spl, withdraw_spl |
| PDAs usadas corretamente | Seeds determinísticas + bump salvo na account |
| Pelo menos um teste automatizado | Suite completa cobrindo happy path + edge cases |
| README claro | Setup, arquitetura, instruções, Program ID |

---

# PARTE 2 — TDD (Technical Design Document)

## 2.1 Arquitetura do Programa

```
┌─────────────────────────────────────────────────┐
│                  SolBank Program                │
│                (Anchor / Rust)                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Instructions:                                  │
│  ┌───────────────┐  ┌──────────────────┐       │
│  │ initialize     │  │ deposit_sol      │       │
│  └───────────────┘  └──────────────────┘       │
│  ┌───────────────┐  ┌──────────────────┐       │
│  │ withdraw_sol   │  │ deposit_spl      │       │
│  └───────────────┘  └──────────────────┘       │
│  ┌───────────────┐  ┌──────────────────┐       │
│  │ withdraw_spl   │  │ close_account    │       │
│  └───────────────┘  └──────────────────┘       │
│                                                 │
│  Accounts (PDAs):                               │
│  ┌───────────────────────────────────────┐     │
│  │ BankAccount (data PDA)                │     │
│  │  - owner: Pubkey                      │     │
│  │  - bump: u8                           │     │
│  │  - created_at: i64                    │     │
│  └───────────────────────────────────────┘     │
│  ┌───────────────────────────────────────┐     │
│  │ SOL Vault (PDA - lamports holder)     │     │
│  │  seeds: ["vault", owner]              │     │
│  └───────────────────────────────────────┘     │
│                                                 │
└─────────────────────────────────────────────────┘
```

## 2.2 Account Model — PDAs

### BankAccount (Data Account)

Armazena os metadados da conta bancária do usuário.

```
Seeds: ["bank_account", owner.key()]
Bump: salvo no account data
```

```rust
#[account]
pub struct BankAccount {
    pub owner: Pubkey,       // 32 bytes - dono da conta
    pub bump: u8,            // 1 byte  - bump da PDA
    pub created_at: i64,     // 8 bytes - timestamp de criação
}
// Total: 32 + 1 + 8 = 41 bytes
// Space: 8 (discriminator) + 41 = 49 bytes
```

### SOL Vault (Lamport Holder)

PDA que segura os lamports depositados. Não precisa de data — só segura SOL.

```
Seeds: ["vault", owner.key()]
Bump: derivado em runtime
```

**Por que duas PDAs?**

Analogia: Pensa no `BankAccount` como o **extrato/ficha cadastral** do banco — guarda quem é o dono e quando abriu a conta. A `Vault` é o **cofre** de fato — onde o dinheiro fica. Separar os dois é um padrão comum em Solana porque:

1. A data account tem tamanho fixo e previsível
2. A vault pode receber/enviar lamports sem corromper dados serializados
3. Para SPL tokens, o token program exige uma Associated Token Account (ATA) separada de qualquer forma

### SPL Token Vault

Para tokens SPL, usamos a **Associated Token Account (ATA)** da vault PDA:

```
ATA derivada de: get_associated_token_address(vault_pda, token_mint)
```

Isso permite que a vault segure qualquer token SPL, criando uma ATA por mint.

## 2.3 Fluxo de Cada Instrução

### `initialize`

```
Quem chama: qualquer wallet (será o owner)
O que faz:
  1. Cria a PDA BankAccount com seeds ["bank_account", owner]
  2. Cria a PDA Vault com seeds ["vault", owner]
  3. Salva owner, bump e timestamp no BankAccount
Validações:
  - Conta não existe ainda (init garante isso)
  - Owner é signer
```

### `deposit_sol`

```
Quem chama: owner da conta
O que faz:
  1. Transfere `amount` lamports do owner → vault PDA
  2. Usa system_program::transfer (CPI)
Validações:
  - Signer == bank_account.owner
  - amount > 0
  - Owner tem saldo suficiente (falha naturalmente no runtime)
```

### `withdraw_sol`

```
Quem chama: owner da conta
O que faz:
  1. Transfere `amount` lamports da vault PDA → owner
  2. Usa transfer direto de lamports (vault PDA assina com seeds)
Validações:
  - Signer == bank_account.owner
  - amount > 0
  - amount <= vault.lamports() (saldo suficiente na vault)
  - Manter rent-exempt mínimo na vault
```

### `deposit_spl`

```
Quem chama: owner da conta
O que faz:
  1. Cria ATA da vault para o mint (se não existir) via init_if_needed
  2. Transfere `amount` tokens da ATA do owner → ATA da vault
  3. Usa token::transfer (CPI)
Validações:
  - Signer == bank_account.owner
  - amount > 0
  - Owner tem tokens suficientes
  - Mint account válido
```

### `withdraw_spl`

```
Quem chama: owner da conta
O que faz:
  1. Transfere `amount` tokens da ATA da vault → ATA do owner
  2. Vault PDA assina a CPI com seeds
Validações:
  - Signer == bank_account.owner
  - amount > 0
  - Vault ATA tem saldo suficiente
```

### `close_account`

```
Quem chama: owner da conta
O que faz:
  1. Verifica que vault está vazia (0 lamports extras além de rent)
  2. Fecha BankAccount, devolve rent ao owner
  3. Fecha Vault, devolve rent ao owner
Validações:
  - Signer == bank_account.owner
  - Vault sem saldo (apenas rent-exempt mínimo)
  - Nenhuma ATA de token com saldo pendente (best effort)
```

## 2.4 Controle de Acesso

Todas as instruções (exceto `initialize`) seguem o mesmo padrão:

```rust
#[account(
    seeds = [b"bank_account", owner.key().as_ref()],
    bump = bank_account.bump,
    has_one = owner  // ← ISSO garante que signer == owner
)]
pub bank_account: Account<'info, BankAccount>,

#[account(mut)]
pub owner: Signer<'info>,  // ← ISSO garante que assinou a tx
```

A combinação de `has_one = owner` + `Signer` é o padrão clássico de access control em Anchor. É como um "if msg.sender == owner" do Solidity, mas validado via constraints declarativas.

## 2.5 Gerenciamento de Erros

```rust
#[error_code]
pub enum SolBankError {
    #[msg("Deposit amount must be greater than zero")]
    InvalidAmount,          // 6000

    #[msg("Insufficient funds in vault")]
    InsufficientFunds,      // 6001

    #[msg("Cannot close account with remaining balance")]
    AccountNotEmpty,        // 6002

    #[msg("Arithmetic overflow")]
    Overflow,               // 6003
}
```

## 2.6 CPIs (Cross-Program Invocations)

| Operação | Programa chamado | CPI |
|----------|-----------------|-----|
| Deposit SOL | System Program | `system_program::transfer` |
| Withdraw SOL | — | Transfer direto de lamports (PDA signer) |
| Deposit SPL | Token Program | `token::transfer` |
| Withdraw SPL | Token Program | `token::transfer` (PDA signer com seeds) |
| Criar ATA | Associated Token Program | `init_if_needed` no Anchor |

## 2.7 Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Linguagem do programa | Rust |
| Framework | Anchor v0.30+ |
| Runtime | Solana BPF |
| Testes | TypeScript + Mocha (via `anchor test`) |
| SDK para testes | @coral-xyz/anchor + @solana/spl-token |
| Network | Devnet (deploy final) + Localnet (desenvolvimento) |

## 2.8 Estrutura do Projeto

```
solbank/
├── programs/
│   └── solbank/
│       ├── src/
│       │   ├── lib.rs              # Entry point + declare_id!
│       │   ├── instructions/
│       │   │   ├── mod.rs
│       │   │   ├── initialize.rs   # Criar conta
│       │   │   ├── deposit_sol.rs  # Depositar SOL
│       │   │   ├── withdraw_sol.rs # Sacar SOL
│       │   │   ├── deposit_spl.rs  # Depositar token SPL
│       │   │   ├── withdraw_spl.rs # Sacar token SPL
│       │   │   └── close_account.rs# Fechar conta
│       │   ├── state/
│       │   │   ├── mod.rs
│       │   │   └── bank_account.rs # Struct BankAccount
│       │   └── errors.rs           # Custom errors
│       └── Cargo.toml
├── tests/
│   └── solbank.ts                  # Suite de testes
├── Anchor.toml
└── README.md
```

---

# PARTE 3 — SPEC (Especificação de Desenvolvimento)

## 3.1 Task Breakdown (Ordem de Implementação)

### Sprint 1: Scaffolding + Core SOL (estimativa: 2-3h)

| # | Task | Arquivos | Critério de Done |
|---|------|----------|-----------------|
| 1 | `anchor init solbank` + estrutura de pastas | projeto inteiro | Compila com `anchor build` |
| 2 | Definir `BankAccount` state | `state/bank_account.rs` | Struct com owner, bump, created_at |
| 3 | Implementar `initialize` | `instructions/initialize.rs` | Cria PDA BankAccount + Vault |
| 4 | Implementar `deposit_sol` | `instructions/deposit_sol.rs` | CPI transfer do owner → vault |
| 5 | Implementar `withdraw_sol` | `instructions/withdraw_sol.rs` | PDA-signed transfer vault → owner |
| 6 | Testes: initialize + deposit + withdraw SOL | `tests/solbank.ts` | `anchor test` passa |

### Sprint 2: SPL Tokens + Polish (estimativa: 2-3h)

| # | Task | Arquivos | Critério de Done |
|---|------|----------|-----------------|
| 7 | Implementar `deposit_spl` | `instructions/deposit_spl.rs` | Token transfer com ATA |
| 8 | Implementar `withdraw_spl` | `instructions/withdraw_spl.rs` | PDA-signed token transfer |
| 9 | Implementar `close_account` | `instructions/close_account.rs` | Fecha conta + devolve rent |
| 10 | Testes: SPL deposit/withdraw + close | `tests/solbank.ts` | Suite completa passa |
| 11 | Custom errors + validações extras | `errors.rs` + instruções | Erros descritivos |

### Sprint 3: Deploy + Docs (estimativa: 1h)

| # | Task | Arquivos | Critério de Done |
|---|------|----------|-----------------|
| 12 | Deploy na devnet | — | Program ID gerado |
| 13 | README completo | `README.md` | Outro dev consegue reproduzir |
| 14 | Revisão final + cleanup | — | Código limpo e documentado |

## 3.2 Spec de Cada Instrução (Contratos)

### `initialize`

```
INSTRUCTION: initialize
SIGNER:      owner (wallet do usuário)
ACCOUNTS:
  - bank_account: PDA init, seeds=["bank_account", owner], payer=owner, space=8+41
  - vault: PDA init, seeds=["vault", owner], payer=owner, space=0
  - owner: mut, signer
  - system_program: Program<System>
ARGS:         nenhum
EFFECTS:
  - Cria BankAccount com { owner, bump, created_at: Clock::get().unix_timestamp }
  - Cria Vault PDA vazia
ERRORS:
  - AccountAlreadyInUse (implícito pelo init do Anchor)
```

### `deposit_sol`

```
INSTRUCTION: deposit_sol
SIGNER:      owner
ACCOUNTS:
  - bank_account: seeds=["bank_account", owner], has_one=owner
  - vault: mut, seeds=["vault", owner]
  - owner: mut, signer
  - system_program: Program<System>
ARGS:         amount: u64 (lamports)
EFFECTS:
  - system_program::transfer(owner → vault, amount)
ERRORS:
  - SolBankError::InvalidAmount se amount == 0
  - InsufficientFundsForRent (runtime, se owner sem saldo)
```

### `withdraw_sol`

```
INSTRUCTION: withdraw_sol
SIGNER:      owner
ACCOUNTS:
  - bank_account: seeds=["bank_account", owner], has_one=owner
  - vault: mut, seeds=["vault", owner]
  - owner: mut, signer
  - system_program: Program<System>
ARGS:         amount: u64 (lamports)
EFFECTS:
  - Transfer lamports: vault → owner (vault PDA assina)
  - Mantém rent-exempt na vault
ERRORS:
  - SolBankError::InvalidAmount se amount == 0
  - SolBankError::InsufficientFunds se amount > saldo disponível
```

### `deposit_spl`

```
INSTRUCTION: deposit_spl
SIGNER:      owner
ACCOUNTS:
  - bank_account: seeds=["bank_account", owner], has_one=owner
  - vault: seeds=["vault", owner]
  - vault_token_account: init_if_needed, ATA(vault, mint), payer=owner
  - owner_token_account: mut (ATA do owner para esse mint)
  - mint: Account<Mint>
  - owner: mut, signer
  - token_program: Program<Token>
  - associated_token_program: Program<AssociatedToken>
  - system_program: Program<System>
ARGS:         amount: u64 (token units, com decimals)
EFFECTS:
  - Cria ATA da vault se não existe
  - token::transfer(owner_ata → vault_ata, amount)
ERRORS:
  - SolBankError::InvalidAmount se amount == 0
  - Token program errors (saldo insuficiente etc)
```

### `withdraw_spl`

```
INSTRUCTION: withdraw_spl
SIGNER:      owner
ACCOUNTS:
  - bank_account: seeds=["bank_account", owner], has_one=owner
  - vault: seeds=["vault", owner]
  - vault_token_account: mut, ATA(vault, mint)
  - owner_token_account: mut, ATA(owner, mint)
  - mint: Account<Mint>
  - owner: mut, signer
  - token_program: Program<Token>
ARGS:         amount: u64
EFFECTS:
  - token::transfer com PDA signer (vault seeds): vault_ata → owner_ata
ERRORS:
  - SolBankError::InvalidAmount se amount == 0
  - SolBankError::InsufficientFunds se vault_ata.amount < amount
```

### `close_account`

```
INSTRUCTION: close_account
SIGNER:      owner
ACCOUNTS:
  - bank_account: mut, close=owner, seeds=["bank_account", owner], has_one=owner
  - vault: mut, seeds=["vault", owner]
  - owner: mut, signer
  - system_program: Program<System>
ARGS:         nenhum
EFFECTS:
  - Verifica vault sem saldo extra
  - Fecha BankAccount (rent → owner)
  - Transfere lamports restantes da vault → owner
ERRORS:
  - SolBankError::AccountNotEmpty se vault tem saldo além do rent
```

## 3.3 Spec dos Testes

```typescript
describe("SolBank", () => {

  // === INITIALIZE ===
  describe("initialize", () => {
    it("✅ cria bank_account e vault PDAs com dados corretos");
    it("✅ bank_account.owner == wallet do signer");
    it("✅ bank_account.created_at é timestamp válido");
    it("❌ falha se mesma wallet tenta inicializar duas vezes");
  });

  // === DEPOSIT SOL ===
  describe("deposit_sol", () => {
    it("✅ deposita SOL e vault.lamports aumenta corretamente");
    it("✅ múltiplos depósitos acumulam saldo");
    it("❌ falha se amount == 0");
    it("❌ falha se signer != owner da bank_account");
  });

  // === WITHDRAW SOL ===
  describe("withdraw_sol", () => {
    it("✅ saca SOL e owner.lamports aumenta");
    it("✅ saca parcial mantém saldo restante na vault");
    it("❌ falha se amount > saldo disponível na vault");
    it("❌ falha se amount == 0");
    it("❌ falha se signer != owner");
  });

  // === DEPOSIT SPL ===
  describe("deposit_spl", () => {
    it("✅ deposita tokens SPL e vault_ata.amount aumenta");
    it("✅ cria ATA da vault automaticamente no primeiro depósito");
    it("❌ falha se amount == 0");
    it("❌ falha se owner sem tokens suficientes");
    it("❌ falha se signer != owner");
  });

  // === WITHDRAW SPL ===
  describe("withdraw_spl", () => {
    it("✅ saca tokens SPL e owner_ata.amount aumenta");
    it("❌ falha se amount > vault_ata.amount");
    it("❌ falha se amount == 0");
    it("❌ falha se signer != owner");
  });

  // === CLOSE ACCOUNT ===
  describe("close_account", () => {
    it("✅ fecha conta e devolve rent ao owner");
    it("❌ falha se vault ainda tem saldo");
    it("❌ falha se signer != owner");
  });

  // === EDGE CASES ===
  describe("edge cases", () => {
    it("✅ dois usuários diferentes criam contas independentes");
    it("✅ deposita e saca o valor exato (saldo final == 0)");
  });
});
```

## 3.4 Comandos de Referência

```bash
# Setup
anchor init solbank
cd solbank

# Desenvolvimento iterativo
anchor build                    # Compila o programa
anchor test                     # Roda testes no localnet
anchor test --skip-local-validator  # Se já tem validator rodando

# Deploy na devnet
solana config set --url devnet
anchor build
anchor deploy --provider.cluster devnet

# Verificar Program ID
solana program show <PROGRAM_ID> --url devnet
```

## 3.5 Decisões Técnicas e Trade-offs

| Decisão | Alternativa | Por que essa escolha |
|---------|-------------|---------------------|
| Vault PDA separada para SOL | Guardar lamports na data account | Mais seguro — evita problemas com serialização do account data quando lamports mudam |
| `init_if_needed` para ATA do SPL | Criar ATA em instrução separada | UX melhor (1 tx ao invés de 2), custo: precisa feature flag no Anchor |
| Bump salvo no BankAccount | Derivar bump toda vez | Performance: evita `find_program_address` em toda instrução |
| Vault com space=0 | System account normal | PDA pura para segurar lamports, sem overhead de data |
| Modular (1 arquivo por instrução) | Tudo em lib.rs | Legibilidade + facilita review dos juízes |

## 3.6 Checklist Pré-Entrega

- [ ] `anchor build` compila sem warnings
- [ ] `anchor test` — todos os testes passam
- [ ] Deploy na devnet com `anchor deploy`
- [ ] Program ID no README
- [ ] README com: descrição, instruções, como rodar
- [ ] Código comentado nas partes importantes
- [ ] Nenhuma chave privada no repositório
- [ ] `.gitignore` inclui `target/`, `node_modules/`, `.anchor/`

---

## Apêndice A: Mapa Mental da Arquitetura

```
Owner Wallet
    │
    ├──► initialize ──► Cria BankAccount PDA + Vault PDA
    │
    ├──► deposit_sol ──► SOL: Owner → Vault PDA (CPI system_program)
    │
    ├──► withdraw_sol ──► SOL: Vault PDA → Owner (PDA signs)
    │
    ├──► deposit_spl ──► Token: Owner ATA → Vault ATA (CPI token_program)
    │
    ├──► withdraw_spl ──► Token: Vault ATA → Owner ATA (PDA signs)
    │
    └──► close_account ──► Fecha tudo, rent → Owner
```

## Apêndice B: Analogia com Banco Tradicional

| Conceito Bancário | Equivalente SolBank |
|-------------------|---------------------|
| Abrir conta | `initialize` — cria PDA com CPF (= wallet pubkey) |
| Cofre | Vault PDA — segura seu dinheiro |
| Ficha cadastral | BankAccount PDA — metadados |
| Depositar no caixa | `deposit_sol` / `deposit_spl` — CPI transfer |
| Sacar no caixa | `withdraw_sol` / `withdraw_spl` — PDA assina saída |
| Encerrar conta | `close_account` — zera tudo e fecha |
| Senha/autenticação | `Signer` + `has_one = owner` — só quem assinou a tx |
| Diferentes moedas | Diferentes mints SPL, cada um com sua ATA |
