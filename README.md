# SolBank: On-Chain Bank Account on Solana

Anchor program for a simple on-chain neobank on Solana. A user opens a PDA-based account, deposits and withdraws `SOL` or `SPL` tokens, and only the account owner can operate it.

Built for Bootcamp Hackathon Global 2026 - Superteam Brazil x NearX, Challenge Option B (`Neobank`).

**Program ID (devnet):** `F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm`  
**Explorer:** <https://explorer.solana.com/address/F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm?cluster=devnet>  
**Repository:** <https://github.com/ThaisFReis/SolBank>

## TL;DR / On-Chain Proof

This repository is not only deployed on devnet: it already has a recorded real execution flow.

- Executed on devnet on `2026-04-02`
- Program instructions executed: `initialize`, `deposit_sol`, `withdraw_sol`, `deposit_spl`, `withdraw_spl`
- Final observable state:
  - `BankAccount PDA`: `GbzDC7huREfBLcdahc42udYWwQof7ZF9F7TrNLjHphpj`
  - `Vault PDA`: `2Bv3KjD51CjW1qMXJwxjVoLUyikGjEh73t8otJs27eUi`
  - `Vault ATA`: `ADtWybVFPsn8TG5WdBFk6ZoLGEEK6Tnh4zUVtBS193Vk`
  - vault SOL balance: `0.13 SOL` usable + `890880` lamports rent-exempt reserve
  - vault SPL balance: `0.25` token

Quick proof links:

- `initialize`: <https://explorer.solana.com/tx/3xinpo8E6AN5W2du4L2h3h6GAgGyshu4LPnq5AurBnPyU869ByABZa4gK56bzpaSE1h1gtqPAiordNBErv3bzY8H?cluster=devnet>
- `deposit_sol`: <https://explorer.solana.com/tx/fdB3qk2wgYuHexLN1YBPYNBNEnfzknZ9B852e3QbWp2PaLuaeJ5vkvYfh3zFzphmpRRHpAStxaX4Za4cY8doY84?cluster=devnet>
- `withdraw_sol`: <https://explorer.solana.com/tx/2w7UH59J5UTDXT2r1n4SxJoBE2ECHVciCLkfSXpnQSdQKDAknRSnJsDFAt3Mc6pRdAbSYXYY4KbJA89V1PEWUuv8?cluster=devnet>
- `deposit_spl`: <https://explorer.solana.com/tx/UCakVxDegK2Gsm9S9SpoJxwgBdfYghAzvRXwz3accTngo6YaLkqWtoyK8mk94PFkGkcbHEEFGZnydGcvHaiQcfv?cluster=devnet>
- `withdraw_spl`: <https://explorer.solana.com/tx/hh8nKBm5J6R7uVLCrRVvcZJNLUhb57eZk7jiE9azhXz7U9QaBqGgF6grUFJtLC4rW6QfteMjj1f9VFSyjSTyQrn?cluster=devnet>

For the full devnet execution record, see the appendix at the end of this README or [devnet-onchain-report.md](./devnet-onchain-report.md).

---

## What It Does

`SolBank` models a basic on-chain bank account:

- the user creates a personal bank account PDA
- the user deposits native `SOL` into a vault PDA
- the user deposits `SPL` tokens into a vault ATA owned by that vault PDA
- the user withdraws funds later
- only the owner of that bank account can operate it

There is no separate `get_balance` instruction. Balances are read directly from on-chain accounts:

- `SOL` balance: the `Vault PDA`
- `SPL` balance: the `Vault ATA`

---

## How It Works

Each user gets two PDAs:

```text
Owner Wallet
    |
    +--> initialize --> BankAccount PDA ["bank_account", owner]  (metadata)
    |                   Vault PDA        ["vault", owner]         (SOL holder)
    |
    +--> deposit_sol  --> SOL: owner wallet -> vault PDA
    +--> withdraw_sol --> SOL: vault PDA -> owner wallet
    |
    +--> deposit_spl  --> token: owner ATA -> vault ATA
    +--> withdraw_spl --> token: vault ATA -> owner ATA
    |
    +--> close_account --> closes BankAccount + Vault, returns rent
```

### Account Model

| Account | Seeds | Space | Purpose |
|---|---|---:|---|
| `BankAccount` | `["bank_account", owner]` | `49` bytes | Stores `owner`, `bump`, `created_at` |
| `Vault` | `["vault", owner]` | `0` bytes | Holds deposited lamports |
| `Vault ATA` | `ATA(vault, mint)` | standard | Holds deposited SPL tokens |

### Access Control

All instructions except `initialize` enforce basic owner-only control:

- `has_one = owner`
- `owner: Signer`

That means only the wallet that created the bank account can deposit, withdraw, or close it.

---

## Available Instructions

| Instruction | Purpose | Key behavior |
|---|---|---|
| `initialize` | Creates `BankAccount` and `Vault` PDAs | one bank account per owner PDA seed set |
| `deposit_sol(amount)` | Moves native `SOL` from owner wallet into the vault | rejects `amount == 0` |
| `withdraw_sol(amount)` | Moves native `SOL` from vault to owner wallet | rejects zero, checks funds, preserves vault rent exemption |
| `deposit_spl(amount)` | Moves `SPL` from owner ATA to vault ATA | rejects zero, auto-creates vault ATA on first deposit |
| `withdraw_spl(amount)` | Moves `SPL` from vault ATA back to owner ATA | rejects zero, checks funds, vault PDA signs CPI |
| `close_account()` | Closes `BankAccount` and `Vault` PDAs | only works when the vault has no withdrawable SOL left |

---

## What You Can Verify On-Chain

This program persists bank state in PDAs and token accounts. It does **not** create a custom transaction ledger account.

What is actually on-chain:

- `BankAccount PDA`
  - owner metadata
  - PDA bump
  - creation timestamp
- `Vault PDA`
  - native `SOL` held by the bank account
- `Vault ATA`
  - `SPL` token balance held by the bank account
- transaction signatures
  - runtime logs
  - slots
  - account balance changes

How to inspect balances:

- `SOL` bank balance -> inspect the `Vault PDA`
- `SPL` bank balance -> inspect the `Vault ATA`

Important note:

The owner wallet paid account-creation costs and transaction fees during the devnet demo. Because of that, you should **not** infer the bank balance by comparing owner wallet before/after values. The bank balance is the balance stored in the vault accounts.

---

## Real Devnet State Snapshot

Recorded flow date: `2026-04-02`

### Main Addresses

| Item | Address |
|---|---|
| Program ID | `F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm` |
| Owner wallet | `A6XszyyTBXLgu2F5CMvvzui5wbvxoo3wAqRrGTdMiKGj` |
| BankAccount PDA | `GbzDC7huREfBLcdahc42udYWwQof7ZF9F7TrNLjHphpj` |
| Vault PDA | `2Bv3KjD51CjW1qMXJwxjVoLUyikGjEh73t8otJs27eUi` |
| SPL mint | `BTAxd85gY5qto8YiVs4dzZ6z5FtKu1sxxViBNPMCnTGJ` |
| Owner ATA | `35UqHA3DYdtdazMoNC2GkwcFVJ2gNovBMAQ2gKXFGhK3` |
| Vault ATA | `ADtWybVFPsn8TG5WdBFk6ZoLGEEK6Tnh4zUVtBS193Vk` |

### Final State

| Item | Value |
|---|---|
| `BankAccount.owner` | `A6XszyyTBXLgu2F5CMvvzui5wbvxoo3wAqRrGTdMiKGj` |
| `BankAccount.bump` | `254` |
| `BankAccount.created_at` | `1775103229` (`2026-04-02 04:13:49 UTC`) |
| Vault raw lamports | `130890880` |
| Vault rent-exempt minimum | `890880` |
| Vault usable balance | `130000000` lamports = `0.13 SOL` |
| Owner ATA balance | `1250000` units = `1.25` tokens |
| Vault ATA balance | `250000` units = `0.25` token |

---

## Local Setup

### Prerequisites

- [Rust](https://rustup.rs/) + `cargo`
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) `v1.18+`
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) `v0.30.1`
- [Node.js](https://nodejs.org/) `v18+`
- `yarn`

### Install

```bash
git clone https://github.com/ThaisFReis/SolBank
cd SolBank
yarn install
```

### Build

```bash
NO_DNA=1 anchor build
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

`anchor test` is configured for a fresh local validator.

The repo includes a local-only test wallet at `tests/fixtures/localnet-wallet.json`, so the default test flow does not depend on `~/.config/solana/id.json`.

```bash
NO_DNA=1 anchor test
```

If you already have a local validator running on `8899`:

```bash
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 NO_DNA=1 anchor test --skip-local-validator
```

---

## Devnet Deployment

The current deployed program is:

```text
F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm
```

Current upgrade authority on devnet:

```text
A6XszyyTBXLgu2F5CMvvzui5wbvxoo3wAqRrGTdMiKGj
```

Deploy flow:

```bash
# Use the wallet that holds the program upgrade authority
solana config set --url devnet --keypair ~/.config/solana/id.json

# Airdrop SOL for deploy fees
solana airdrop 2 --url devnet

# Deploy
NO_DNA=1 anchor deploy --provider.cluster devnet --provider.wallet ~/.config/solana/id.json

# Verify
solana program show F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm --url devnet
```

---

## Project Structure

```text
programs/solbank/src/
|- lib.rs                    # Entry point, declare_id!, instruction dispatch
|- errors.rs                 # Custom error codes
|- state/
|  `- bank_account.rs        # BankAccount struct
`- instructions/
   |- initialize.rs          # Create PDAs
   |- deposit_sol.rs         # Deposit SOL
   |- withdraw_sol.rs        # Withdraw SOL
   |- deposit_spl.rs         # Deposit SPL tokens
   |- withdraw_spl.rs        # Withdraw SPL tokens
   `- close_account.rs       # Close account
tests/
`- solbank.ts                # Full test suite (TypeScript + Mocha)
```

---

## Error Codes

| Code | Name | Description |
|---|---|---|
| `6000` | `InvalidAmount` | Amount must be greater than zero |
| `6001` | `InsufficientFunds` | Not enough balance in vault |
| `6002` | `AccountNotEmpty` | Cannot close account with remaining balance |
| `6003` | `Overflow` | Arithmetic overflow |

---

## Appendix: Devnet Transaction Record

This appendix records the real devnet execution used as proof for this repository.

### Executed Flow

1. `initialize`
2. `deposit_sol` of `0.2 SOL`
3. `withdraw_sol` of `0.07 SOL`
4. create test SPL mint with `6` decimals
5. create owner ATA
6. `mintTo` owner ATA with `1.5` tokens
7. `deposit_spl` of `0.4` token
8. `withdraw_spl` of `0.15` token

### Transaction Table

| Step | Signature | Slot | Note |
|---|---|---:|---|
| `initialize` | `3xinpo8E6AN5W2du4L2h3h6GAgGyshu4LPnq5AurBnPyU869ByABZa4gK56bzpaSE1h1gtqPAiordNBErv3bzY8H` | `452669515` | creates `BankAccount PDA` and `Vault PDA` |
| `deposit_sol` | `fdB3qk2wgYuHexLN1YBPYNBNEnfzknZ9B852e3QbWp2PaLuaeJ5vkvYfh3zFzphmpRRHpAStxaX4Za4cY8doY84` | `452669518` | deposits `200000000` lamports |
| `withdraw_sol` | `2w7UH59J5UTDXT2r1n4SxJoBE2ECHVciCLkfSXpnQSdQKDAknRSnJsDFAt3Mc6pRdAbSYXYY4KbJA89V1PEWUuv8` | `452669520` | withdraws `70000000` lamports |
| `mint creation` | `64soBp38r3c5qD3CaPypBn46CnDQQjg3yvRqEt5fwjNPZUBcUbMLQkFTS4x63o8hxNbtazRDGxRoG8QwGhXNAzmL` | `452669523` | creates test SPL mint |
| `owner ATA creation` | `2YEo3j8WMrFhfK1Puc1WaCS184W2z3eTbWs89WnYvCiVDieXeT7UMFrTPrmBr8Mnpb9KEXLvcsJPrvd8s6BN65bs` | `452669525` | creates owner ATA |
| `mintTo` | `DfxwJFnRAywJiJZZU5Q3sCU27oEZAD5vLyskRghBc8ntj1QJkNYwMSmmit95XTKVtDRh5nh5Rf4u5HUo1UYurPy` | `452669528` | mints `1.5` tokens to owner |
| `deposit_spl` | `UCakVxDegK2Gsm9S9SpoJxwgBdfYghAzvRXwz3accTngo6YaLkqWtoyK8mk94PFkGkcbHEEFGZnydGcvHaiQcfv` | `452669532` | creates vault ATA and deposits `0.4` token |
| `withdraw_spl` | `hh8nKBm5J6R7uVLCrRVvcZJNLUhb57eZk7jiE9azhXz7U9QaBqGgF6grUFJtLC4rW6QfteMjj1f9VFSyjSTyQrn` | `452669535` | withdraws `0.15` token from vault |

### Explorer Links for Recorded Accounts

- Program: <https://explorer.solana.com/address/F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm?cluster=devnet>
- Owner wallet: <https://explorer.solana.com/address/A6XszyyTBXLgu2F5CMvvzui5wbvxoo3wAqRrGTdMiKGj?cluster=devnet>
- BankAccount PDA: <https://explorer.solana.com/address/GbzDC7huREfBLcdahc42udYWwQof7ZF9F7TrNLjHphpj?cluster=devnet>
- Vault PDA: <https://explorer.solana.com/address/2Bv3KjD51CjW1qMXJwxjVoLUyikGjEh73t8otJs27eUi?cluster=devnet>
- SPL mint: <https://explorer.solana.com/address/BTAxd85gY5qto8YiVs4dzZ6z5FtKu1sxxViBNPMCnTGJ?cluster=devnet>
- Owner ATA: <https://explorer.solana.com/address/35UqHA3DYdtdazMoNC2GkwcFVJ2gNovBMAQ2gKXFGhK3?cluster=devnet>
- Vault ATA: <https://explorer.solana.com/address/ADtWybVFPsn8TG5WdBFk6ZoLGEEK6Tnh4zUVtBS193Vk?cluster=devnet>

### Final Interpretation

- Deposited into vault: `0.2 SOL`
- Withdrawn from vault: `0.07 SOL`
- Final usable vault SOL balance: `0.13 SOL`
- Rent reserve still held by vault PDA: `890880` lamports
- Minted to owner: `1.5` tokens
- Deposited to vault ATA: `0.4` token
- Withdrawn from vault ATA: `0.15` token
- Final vault ATA balance: `0.25` token

Supporting document: [devnet-onchain-report.md](./devnet-onchain-report.md)
