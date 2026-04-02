# SolBank Devnet On-Chain Report

Relatorio de execucao real em devnet no dia `2026-04-02`.

Este documento nao adiciona nenhuma instrucao nova ao programa. Ele apenas registra o fluxo executado no programa ja deployado em devnet e resume exatamente o que ficou visivel on-chain.

## Fluxo executado

1. `initialize`
2. `deposit_sol` de `0.2 SOL`
3. `withdraw_sol` de `0.07 SOL`
4. criacao de um mint SPL de teste com `6` decimais
5. `mintTo` de `1.5` tokens para a ATA da owner
6. `deposit_spl` de `0.4` token
7. `withdraw_spl` de `0.15` token

## Enderecos principais

| Item | Endereco |
|---|---|
| Program ID | `F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm` |
| Owner wallet | `A6XszyyTBXLgu2F5CMvvzui5wbvxoo3wAqRrGTdMiKGj` |
| BankAccount PDA | `GbzDC7huREfBLcdahc42udYWwQof7ZF9F7TrNLjHphpj` |
| Vault PDA | `2Bv3KjD51CjW1qMXJwxjVoLUyikGjEh73t8otJs27eUi` |
| SPL mint | `BTAxd85gY5qto8YiVs4dzZ6z5FtKu1sxxViBNPMCnTGJ` |
| Owner ATA | `35UqHA3DYdtdazMoNC2GkwcFVJ2gNovBMAQ2gKXFGhK3` |
| Vault ATA | `ADtWybVFPsn8TG5WdBFk6ZoLGEEK6Tnh4zUVtBS193Vk` |

## Explorer

- Program: <https://explorer.solana.com/address/F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm?cluster=devnet>
- Owner wallet: <https://explorer.solana.com/address/A6XszyyTBXLgu2F5CMvvzui5wbvxoo3wAqRrGTdMiKGj?cluster=devnet>
- BankAccount PDA: <https://explorer.solana.com/address/GbzDC7huREfBLcdahc42udYWwQof7ZF9F7TrNLjHphpj?cluster=devnet>
- Vault PDA: <https://explorer.solana.com/address/2Bv3KjD51CjW1qMXJwxjVoLUyikGjEh73t8otJs27eUi?cluster=devnet>
- SPL mint: <https://explorer.solana.com/address/BTAxd85gY5qto8YiVs4dzZ6z5FtKu1sxxViBNPMCnTGJ?cluster=devnet>
- Owner ATA: <https://explorer.solana.com/address/35UqHA3DYdtdazMoNC2GkwcFVJ2gNovBMAQ2gKXFGhK3?cluster=devnet>
- Vault ATA: <https://explorer.solana.com/address/ADtWybVFPsn8TG5WdBFk6ZoLGEEK6Tnh4zUVtBS193Vk?cluster=devnet>

## O que ficou on-chain

### Estado persistente do programa

- O `BankAccount PDA` existe e esta owned pelo programa `SolBank`.
- O `Vault PDA` existe e esta owned pelo programa `SolBank`.
- O `BankAccount PDA` armazena:
  - `owner = A6XszyyTBXLgu2F5CMvvzui5wbvxoo3wAqRrGTdMiKGj`
  - `bump = 254`
  - `created_at = 1775103229` (`2026-04-02 04:13:49 UTC`)
- O tamanho do `BankAccount` on-chain e `49 bytes`, compatível com a struct atual do programa.

### Estado persistente de tokens

- Existe um mint SPL de teste com `6` decimais.
- Existe uma ATA da owner para esse mint.
- Existe uma ATA do vault para esse mint.
- A ATA da owner tem como token authority a wallet da owner.
- A ATA do vault tem como token authority o `Vault PDA`.

### Historico das operacoes

No desenho atual do programa, o historico nao fica salvo em uma conta propria de "ledger" dentro do programa.

O que fica registrado on-chain para cada operacao e:

- a assinatura da transacao
- o slot
- o block time
- os logs do runtime
- as mudancas de saldo e de contas

Ou seja: as transacoes estao registradas on-chain no proprio historico do Solana, e o estado final fica refletido nos PDAs e nas token accounts.

## Estado final apos a execucao

### SOL

- `vaultLamports = 130890880`
- `vaultRentExemptMinimum = 890880`
- `vaultAvailableLamports = 130000000`
- saldo util no vault: `0.13 SOL`

Leitura:

- foi depositado `0.2 SOL`
- foi sacado `0.07 SOL`
- sobraram `0.13 SOL` disponiveis no vault
- os `890880` lamports restantes sao o colchao de rent exemption do PDA do vault

### SPL

- `mintedToOwnerAmount = 1500000` unidades = `1.5` tokens
- `splDepositedToVault = 400000` unidades = `0.4` token
- `splWithdrawnToOwner = 150000` unidades = `0.15` token
- `ownerAtaAmount = 1250000` unidades = `1.25` tokens
- `vaultAtaAmount = 250000` unidades = `0.25` token

Leitura:

- a owner recebeu `1.5` tokens mintados
- depositou `0.4` token no vault
- retirou `0.15` token do vault
- ficaram `0.25` token no vault e `1.25` token na ATA da owner

## Transacoes executadas

| Etapa | Assinatura | Slot | Observacao |
|---|---|---:|---|
| initialize | `3xinpo8E6AN5W2du4L2h3h6GAgGyshu4LPnq5AurBnPyU869ByABZa4gK56bzpaSE1h1gtqPAiordNBErv3bzY8H` | `452669515` | cria `BankAccount PDA` e `Vault PDA` |
| deposit_sol | `fdB3qk2wgYuHexLN1YBPYNBNEnfzknZ9B852e3QbWp2PaLuaeJ5vkvYfh3zFzphmpRRHpAStxaX4Za4cY8doY84` | `452669518` | deposita `200000000` lamports |
| withdraw_sol | `2w7UH59J5UTDXT2r1n4SxJoBE2ECHVciCLkfSXpnQSdQKDAknRSnJsDFAt3Mc6pRdAbSYXYY4KbJA89V1PEWUuv8` | `452669520` | saca `70000000` lamports |
| mint creation | `64soBp38r3c5qD3CaPypBn46CnDQQjg3yvRqEt5fwjNPZUBcUbMLQkFTS4x63o8hxNbtazRDGxRoG8QwGhXNAzmL` | `452669523` | cria o mint SPL de teste |
| owner ATA creation | `2YEo3j8WMrFhfK1Puc1WaCS184W2z3eTbWs89WnYvCiVDieXeT7UMFrTPrmBr8Mnpb9KEXLvcsJPrvd8s6BN65bs` | `452669525` | cria a ATA da owner |
| mintTo | `DfxwJFnRAywJiJZZU5Q3sCU27oEZAD5vLyskRghBc8ntj1QJkNYwMSmmit95XTKVtDRh5nh5Rf4u5HUo1UYurPy` | `452669528` | minta `1.5` tokens para a owner |
| deposit_spl | `UCakVxDegK2Gsm9S9SpoJxwgBdfYghAzvRXwz3accTngo6YaLkqWtoyK8mk94PFkGkcbHEEFGZnydGcvHaiQcfv` | `452669532` | cria a ATA do vault e deposita `0.4` token |
| withdraw_spl | `hh8nKBm5J6R7uVLCrRVvcZJNLUhb57eZk7jiE9azhXz7U9QaBqGgF6grUFJtLC4rW6QfteMjj1f9VFSyjSTyQrn` | `452669535` | saca `0.15` token do vault |

## Logs relevantes do programa

- `initialize`: `SolBank account created for owner: A6XszyyTBXLgu2F5CMvvzui5wbvxoo3wAqRrGTdMiKGj`
- `deposit_sol`: `Deposited 200000000 lamports into vault`
- `withdraw_sol`: `Withdrew 70000000 lamports from vault`
- `deposit_spl`: `Deposited 400000 tokens into vault ATA`
- `withdraw_spl`: `Withdrew 150000 tokens from vault ATA`

## Como inspecionar no explorer

### Para ver o estado atual

- abra o `BankAccount PDA` para confirmar que ele e owned pelo programa e que os dados existem
- abra o `Vault PDA` para confirmar que ele e owned pelo programa e segura os lamports
- abra o `Vault ATA` para confirmar que a authority do token account e o `Vault PDA`

### Para ver o historico

- abra cada assinatura de transacao acima
- veja a aba de logs
- veja os account inputs/outputs
- veja a mudanca de saldo em SOL e SPL

## Resumo objetivo

Hoje, o que voce encontra on-chain para este fluxo e:

- um programa deployado em devnet
- uma wallet owner que operou a conta
- um `BankAccount PDA`
- um `Vault PDA`
- um mint SPL de teste
- uma ATA da owner
- uma ATA do vault
- nove assinaturas de transacao com logs e efeitos de estado
- saldo final de `0.13 SOL` no vault
- saldo final de `0.25` token no vault ATA

Se voce quiser, o proximo passo pode ser eu transformar este mesmo fluxo em um script repetivel de demonstracao para devnet, sem alterar o programa on-chain.
