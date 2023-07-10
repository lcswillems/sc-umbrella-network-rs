#![no_std]

multiversx_sc::imports!();

#[multiversx_sc::contract]
pub trait StakingBank:
    staking_bank_module::StakingBankModule + staking_bank_module::events::StakingBankEventsModule
{
    #[init]
    fn init(&self) {}
}
