#![no_std]

multiversx_sc::imports!();

#[multiversx_sc::contract]
pub trait UmbrellaFeeds
{
    #[init]
    fn init(&self) {
    }
}
