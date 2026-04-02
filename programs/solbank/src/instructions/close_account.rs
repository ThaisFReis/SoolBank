use anchor_lang::prelude::*;
use crate::state::BankAccount;
use crate::errors::SolBankError;

#[derive(Accounts)]
pub struct CloseAccount<'info> {
    /// Anchor closes this account and returns rent to owner automatically
    #[account(
        mut,
        close = owner,
        seeds = [b"bank_account", owner.key().as_ref()],
        bump = bank_account.bump,
        has_one = owner,
    )]
    pub bank_account: Account<'info, BankAccount>,

    /// CHECK: Program-owned PDA validated by seeds + bump. Lamports drained manually.
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

pub fn handler(ctx: Context<CloseAccount>) -> Result<()> {
    let rent_min = Rent::get()?.minimum_balance(0);
    let vault_lamports = ctx.accounts.vault.lamports();

    // Vault must hold no deposited SOL beyond the rent-exempt minimum
    require!(vault_lamports <= rent_min, SolBankError::AccountNotEmpty);

    // Drain vault lamports to owner (including the rent-exempt minimum)
    **ctx.accounts.vault.to_account_info().try_borrow_mut_lamports()? -= vault_lamports;
    **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += vault_lamports;

    // bank_account is closed by Anchor via `close = owner` constraint

    msg!("SolBank account closed. Rent returned to owner.");
    Ok(())
}
