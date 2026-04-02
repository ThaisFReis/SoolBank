use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::BankAccount;
use crate::errors::SolBankError;

#[derive(Accounts)]
pub struct WithdrawSpl<'info> {
    #[account(
        seeds = [b"bank_account", owner.key().as_ref()],
        bump = bank_account.bump,
        has_one = owner,
    )]
    pub bank_account: Account<'info, BankAccount>,

    /// CHECK: Program-owned PDA validated by seeds + bump. Signs token CPI with signer seeds.
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

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
}

pub fn handler(ctx: Context<WithdrawSpl>, amount: u64) -> Result<()> {
    require!(amount > 0, SolBankError::InvalidAmount);
    require!(
        ctx.accounts.vault_token_account.amount >= amount,
        SolBankError::InsufficientFunds
    );

    // Vault PDA signs the CPI using its seeds
    let owner_key = ctx.accounts.owner.key();
    let vault_bump = ctx.bumps.vault;
    let seeds: &[&[u8]] = &[b"vault", owner_key.as_ref(), &[vault_bump]];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.owner_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;

    msg!("Withdrew {} tokens from vault ATA", amount);
    Ok(())
}
