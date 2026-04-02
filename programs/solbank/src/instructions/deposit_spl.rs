use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};
use crate::state::BankAccount;
use crate::errors::SolBankError;

#[derive(Accounts)]
pub struct DepositSpl<'info> {
    #[account(
        seeds = [b"bank_account", owner.key().as_ref()],
        bump = bank_account.bump,
        has_one = owner,
    )]
    pub bank_account: Account<'info, BankAccount>,

    /// CHECK: Program-owned PDA validated by seeds + bump. Used as ATA authority.
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    /// Vault's ATA for this mint — created on first deposit if it doesn't exist
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Owner's ATA — must exist before calling this instruction
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, SolBankError::InvalidAmount);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.owner_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
    )?;

    msg!("Deposited {} tokens into vault ATA", amount);
    Ok(())
}
