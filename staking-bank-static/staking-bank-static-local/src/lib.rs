#![no_std]

multiversx_sc::imports!();

use multiversx_sc::hex_literal::hex;

#[multiversx_sc::contract]
pub trait StakingBank:
    staking_bank_module::StakingBankModule + staking_bank_module::events::StakingBankEventsModule
{
    #[init]
    fn init(&self) {
        if self.addresses().is_empty() {
            self.create(
                ManagedAddress::from(hex!("f4c5ec79fd26fe080ffbb0d0ac0dcce901e54e58f0abb5bb883394916a2b261a")), // alice's wallet
                ManagedBuffer::from(b"localhost")
            );
        }
    }
}
