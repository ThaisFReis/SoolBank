use anchor_lang::prelude::*;

#[account]
pub struct BankAccount {
    pub owner: Pubkey,      // 32 bytes
    pub bump: u8,           // 1 byte
    pub created_at: i64,    // 8 bytes
}

impl BankAccount {
    // 8 (discriminator) + 32 (owner) + 1 (bump) + 8 (created_at)
    pub const LEN: usize = 8 + 32 + 1 + 8;
}
