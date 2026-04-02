use anchor_lang::prelude::*;

#[error_code]
pub enum SolBankError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,          // 6000

    #[msg("Insufficient funds in vault")]
    InsufficientFunds,      // 6001

    #[msg("Cannot close account with remaining balance")]
    AccountNotEmpty,        // 6002

    #[msg("Arithmetic overflow")]
    Overflow,               // 6003
}
