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
                ManagedAddress::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1")), // alice's wallet
                ManagedBuffer::from(b"localhost")
            );
        }
    }
}
