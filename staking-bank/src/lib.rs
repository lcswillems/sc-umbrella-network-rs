#![no_std]

multiversx_sc::imports!();

#[multiversx_sc::contract]
pub trait StakingBank: staking_bank_module::StakingBankModule
{
    #[init]
    fn init(&self) {
    }
}
