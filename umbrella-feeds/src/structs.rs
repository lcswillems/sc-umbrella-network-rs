multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[derive(TypeAbi, TopEncode, TopDecode, NestedEncode, NestedDecode, ManagedVecItem, Debug)]
pub struct PriceData<M: ManagedTypeApi> {
    pub data: u8, // TODO: This might not be needed since the contract is upgradable
    pub heartbeat: u32,
    pub timestamp: u32,
    pub price: BigUint<M>,
}

#[derive(TypeAbi, TopEncode, TopDecode, NestedEncode, NestedDecode, ManagedVecItem, Debug)]
pub struct Signature<M: ManagedTypeApi> {
    pub v: u8,
    pub r: ManagedBuffer<M>,
    pub s: ManagedBuffer<M>,

    pub key: ManagedAddress<M>,
}
