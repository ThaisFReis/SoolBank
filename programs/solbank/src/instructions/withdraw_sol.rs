use anchor_lang::prelude::*;
use crate::state::BankAccount;
use crate::errors::SolBankError;

#[derive(Accounts)]
pub struct WithdrawSol<'info> {
    #[account(
        seeds = [b"bank_account", owner.key().as_ref()],
        bump = bank_account.bump,
        has_one = owner,
    )]
    pub bank_account: Account<'info, BankAccount>,

    /// CHECK: Program-owned PDA validated by seeds + bump. Lamports moved via direct mutation.
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<WithdrawSol>, amount: u64) -> Result<()> {
    require!(amount > 0, SolBankError::InvalidAmount);

    // Keep rent-exempt minimum in vault to preserve the account
    let rent_min = Rent::get()?.minimum_balance(0);
    let vault_lamports = ctx.accounts.vault.lamports();
    let available = vault_lamports
        .checked_sub(rent_min)
        .ok_or(SolBankError::InsufficientFunds)?;

    require!(amount <= available, SolBankError::InsufficientFunds);

    // Direct lamport transfer — vault is program-owned so no CPI required
    **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;

    msg!("Withdrew {} lamports from vault", amount);
    Ok(())
}
