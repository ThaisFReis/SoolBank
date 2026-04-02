use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use crate::state::BankAccount;
use crate::errors::SolBankError;

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(
        seeds = [b"bank_account", owner.key().as_ref()],
        bump = bank_account.bump,
        has_one = owner,
    )]
    pub bank_account: Account<'info, BankAccount>,

    /// CHECK: Program-owned PDA validated by seeds + bump. Receives SOL via system_program CPI.
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

pub fn handler(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
    require!(amount > 0, SolBankError::InvalidAmount);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        amount,
    )?;

    msg!("Deposited {} lamports into vault", amount);
    Ok(())
}
