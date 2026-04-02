use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("F8cAEWCUNRc62x1aBi9PFjqhijyqjFQuoqVKcYJ1duxm");

#[program]
pub mod solbank {
    use super::*;

    /// Creates the BankAccount PDA and Vault PDA for a new user
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Deposits native SOL into the vault (owner → vault CPI)
    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        instructions::deposit_sol::handler(ctx, amount)
    }

    /// Withdraws native SOL from the vault (vault → owner, PDA signs)
    pub fn withdraw_sol(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
        instructions::withdraw_sol::handler(ctx, amount)
    }

    /// Deposits SPL tokens into the vault's ATA (creates ATA if needed)
    pub fn deposit_spl(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
        instructions::deposit_spl::handler(ctx, amount)
    }

    /// Withdraws SPL tokens from the vault's ATA (vault PDA signs CPI)
    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
        instructions::withdraw_spl::handler(ctx, amount)
    }

    /// Closes the BankAccount and Vault PDAs, returning rent to owner
    pub fn close_account(ctx: Context<CloseAccount>) -> Result<()> {
        instructions::close_account::handler(ctx)
    }
}
