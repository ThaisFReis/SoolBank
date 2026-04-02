use anchor_lang::prelude::*;
use crate::state::BankAccount;

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The bank account PDA — stores owner metadata
    #[account(
        init,
        payer = owner,
        space = BankAccount::LEN,
        seeds = [b"bank_account", owner.key().as_ref()],
        bump,
    )]
    pub bank_account: Account<'info, BankAccount>,

    /// The vault PDA — holds deposited SOL (space=0, just a lamport bucket).
    /// CHECK: This is a program-owned PDA validated by seeds + bump. No data is stored.
    #[account(
        init,
        payer = owner,
        space = 0,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let bank_account = &mut ctx.accounts.bank_account;
    bank_account.owner = ctx.accounts.owner.key();
    bank_account.bump = ctx.bumps.bank_account;
    bank_account.created_at = Clock::get()?.unix_timestamp;

    msg!("SolBank account created for owner: {}", ctx.accounts.owner.key());
    Ok(())
}
