# SolBank — On-Chain Neobank on Solana

A Solana Anchor program that simulates an on-chain bank account. Users can create their own account (PDA), deposit and withdraw SOL or SPL tokens, with owner-only access control.

Built for Bootcamp Hackathon Global 2026 — Superteam Brazil × NearX (Challenge Option B: Neobank).

**Program ID (devnet):** `F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm`

---

## Architecture

Each user gets two PDAs:

```
Owner Wallet
    │
    ├──► initialize ──► BankAccount PDA ["bank_account", owner]  (metadata)
    │                   Vault PDA        ["vault", owner]         (SOL holder)
    │
    ├──► deposit_sol  ──► SOL: Owner → Vault (system_program CPI)
    ├──► withdraw_sol ──► SOL: Vault → Owner (direct lamport transfer)
    │
    ├──► deposit_spl  ──► Token: Owner ATA → Vault ATA (token_program CPI)
    ├──► withdraw_spl ──► Token: Vault ATA → Owner ATA (PDA-signed CPI)
    │
    └──► close_account ──► Closes BankAccount + Vault, rent → Owner
```

### Account Model

| Account | Seeds | Space | Purpose |
|---|---|---|---|
| `BankAccount` | `["bank_account", owner]` | 49 bytes | Stores owner, bump, created_at |
| `Vault` | `["vault", owner]` | 0 bytes | Holds deposited SOL |
| `Vault ATA` | ATA(vault, mint) | standard | Holds deposited SPL tokens |

### Access Control

All instructions (except `initialize`) use `has_one = owner` + `Signer` — only the account owner can operate.

---

## Instructions

### `initialize`
Creates the `BankAccount` and `Vault` PDAs for a new user.
- **Args:** none
- **Accounts:** `bank_account` (init), `vault` (init), `owner` (signer), `system_program`

### `deposit_sol`
Transfers native SOL from the owner's wallet into the vault.
- **Args:** `amount: u64` (lamports)
- **Errors:** `InvalidAmount` if amount == 0

### `withdraw_sol`
Transfers native SOL from the vault to the owner's wallet. Preserves rent-exempt minimum in vault.
- **Args:** `amount: u64` (lamports)
- **Errors:** `InvalidAmount`, `InsufficientFunds`

### `deposit_spl`
Transfers SPL tokens from the owner's ATA to the vault's ATA. Creates vault ATA on first deposit.
- **Args:** `amount: u64` (token units including decimals)
- **Errors:** `InvalidAmount`

### `withdraw_spl`
Transfers SPL tokens from the vault's ATA to the owner's ATA. Vault PDA signs the CPI.
- **Args:** `amount: u64`
- **Errors:** `InvalidAmount`, `InsufficientFunds`

### `close_account`
Closes the `BankAccount` and `Vault` PDAs, returning all rent to the owner. Vault must have no deposited SOL.
- **Args:** none
- **Errors:** `AccountNotEmpty` if vault has balance beyond rent minimum

---

## Setup

### Prerequisites

- [Rust](https://rustup.rs/) + `cargo`
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) v1.18+
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) v0.30.1
- [Node.js](https://nodejs.org/) v18+ + Yarn

### Install

```bash
git clone <repo-url>
cd SolBank
yarn install
```

### Build

```bash
anchor build
```

This repo is pinned to the deploy keypair in `target/deploy/solbank-keypair.json`, which resolves to:

```text
F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm
```

If you regenerate the program keypair, update both:
1. `declare_id!` in `programs/solbank/src/lib.rs`
2. `[programs.localnet]` and `[programs.devnet]` in `Anchor.toml`

---

## Running Tests

Tests run on a local validator automatically:

```bash
anchor test
```

To run against an already-running local validator:
```bash
anchor test --skip-local-validator
```

---

## Deploy to Devnet

```bash
# Switch to devnet
solana config set --url devnet

# Airdrop SOL for deploy fees
solana airdrop 2

# Deploy
anchor deploy --provider.cluster devnet

# Verify
solana program show <PROGRAM_ID> --url devnet
```

This program is deployed on devnet at `F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm`.

---

## Project Structure

```
programs/solbank/src/
├── lib.rs                    # Entry point, declare_id!, instruction dispatch
├── errors.rs                 # Custom error codes
├── state/
│   └── bank_account.rs       # BankAccount struct
└── instructions/
    ├── initialize.rs         # Create PDAs
    ├── deposit_sol.rs        # Deposit SOL
    ├── withdraw_sol.rs       # Withdraw SOL
    ├── deposit_spl.rs        # Deposit SPL tokens
    ├── withdraw_spl.rs       # Withdraw SPL tokens
    └── close_account.rs      # Close account
tests/
└── solbank.ts                # Full test suite (TypeScript + Mocha)
```

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| 6000 | `InvalidAmount` | Amount must be greater than zero |
| 6001 | `InsufficientFunds` | Not enough balance in vault |
| 6002 | `AccountNotEmpty` | Cannot close account with remaining balance |
| 6003 | `Overflow` | Arithmetic overflow |
