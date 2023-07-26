#![no_std]

multiversx_sc::imports!();

use crate::structs::{PriceData, Signature};
use multiversx_sc::api::KECCAK256_RESULT_LEN;

pub mod proxy;
pub mod structs;

const MULTIVERSX_PREFIX: &[u8; 30] = b"\x19MultiversX Signed Message:\n32";

#[multiversx_sc::contract]
pub trait UmbrellaFeeds: proxy::ProxyModule {
    #[init]
    fn init(&self, staking_bank: ManagedAddress, required_signatures: usize, decimals: u8) {
        self.staking_bank().set(staking_bank);
        self.required_signatures().set(required_signatures);
        self.decimals().set(decimals);
    }

    #[endpoint]
    fn update(
        &self,
        price_keys: MultiValueManagedVecCounted<ManagedBuffer>,
        price_datas: MultiValueManagedVecCounted<PriceData<Self::Api>>,
        signatures: MultiValueManagedVecCounted<Signature<Self::Api>>,
    ) {
        // below check is only for pretty errors, so we can safe gas and allow for raw revert
        // require!(price_keys.len() == price_datas.len(), "Arrays data do not match");

        let price_keys_vec = price_keys.into_vec();
        let price_datas_vec = price_datas.into_vec();

        let price_data_hash = self.get_price_data_hash(&price_keys_vec, &price_datas_vec);

        self.verify_signatures(&price_data_hash, signatures);

        for index in 0..price_datas_vec.len() {
            let price_data: PriceData<Self::Api> = price_datas_vec.get(index);

            let old_price_mapper = self.prices(&price_keys_vec.get(index));

            if !old_price_mapper.is_empty() {
                let old_price: PriceData<Self::Api> = old_price_mapper.get();

                // we do not allow for older prices
                // at the same time it prevents from reusing signatures
                require!(price_data.timestamp > old_price.timestamp, "Old data");
            }

            old_price_mapper.set(price_data);
        }
    }

    // TODO: No fallback mechanism was implemented currently since the contract is upgradable
    #[view(getManyPriceData)]
    fn get_many_price_data(
        &self,
        keys: MultiValueEncoded<ManagedBuffer>,
    ) -> MultiValueEncoded<PriceData<Self::Api>> {
        let mut data = MultiValueEncoded::new();

        for key in keys.into_iter() {
            data.push(self.prices(&key).get());
        }

        data
    }

    #[view(getPriceData)]
    fn get_price_data(&self, key: ManagedBuffer) -> PriceData<Self::Api> {
        self.prices(&key).get()
    }

    #[view(getPrice)]
    fn get_price(&self, key: ManagedBuffer) -> BigUint {
        self.prices(&key).get().price
    }

    #[view(getPriceTimestamp)]
    fn get_price_timestamp(&self, key: ManagedBuffer) -> MultiValue2<BigUint, u32> {
        let price = self.prices(&key).get();

        MultiValue2::from((price.price, price.timestamp))
    }

    #[view(getPriceTimestampHeartbeat)]
    fn get_price_timestamp_heartbeat(&self, key: ManagedBuffer) -> MultiValue3<BigUint, u32, u32> {
        let price: PriceData<Self::Api> = self.prices(&key).get();

        MultiValue3::from((price.price, price.timestamp, price.heartbeat))
    }

    #[view(getPriceDataByName)]
    fn get_price_data_by_name(&self, name: ManagedBuffer) -> PriceData<Self::Api> {
        let key = self.crypto().keccak256(name);

        self.prices(&key.as_managed_buffer()).get()
    }

    fn get_price_data_hash(
        &self,
        price_keys: &ManagedVec<ManagedBuffer>,
        price_datas: &ManagedVec<PriceData<Self::Api>>,
    ) -> ManagedByteArray<KECCAK256_RESULT_LEN> {
        let mut data = ManagedBuffer::new();

        // data.append(get_chain_id()); // TODO: Can chainId be retrieved from the contract?
        data.append(&self.blockchain().get_sc_address().as_managed_buffer());

        for price_key in price_keys.iter() {
            data.append(&price_key);
        }

        for price_data in price_datas.iter() {
            data.append(&self.decimal_to_ascii(price_data.heartbeat as u64));
            data.append(&self.decimal_to_ascii(price_data.timestamp as u64));
            data.append(&price_data.price.to_bytes_be_buffer());
        }

        self.crypto().keccak256(data)
    }

    #[view]
    fn verify_signatures(
        &self,
        hash: &ManagedByteArray<KECCAK256_RESULT_LEN>,
        signatures: MultiValueManagedVecCounted<Signature<Self::Api>>,
    ) {
        let required_signatures = self.required_signatures().get();

        require!(
            signatures.len() >= required_signatures,
            "Not enough signatures"
        );

        let mut validators = MultiValueEncoded::<Self::Api, ManagedAddress>::new();

        let signatures_vec = signatures.into_vec();

        for index in 0..required_signatures {
            let raw_signature: Signature<Self::Api> = signatures_vec.get(index);

            self.verify_signature(&hash, &raw_signature);

            validators.push(raw_signature.address);
        }

        require!(self.verify_validators(validators), "Invalid signer");
    }

    fn verify_signature(
        &self,
        initial_hash: &ManagedByteArray<KECCAK256_RESULT_LEN>,
        raw_signature: &Signature<Self::Api>,
    ) {
        let mut data = ManagedBuffer::new();

        // TODO: Is this prefix needed? And it can be moved to the initial_hash instead
        data.append(&ManagedBuffer::from(MULTIVERSX_PREFIX));
        data.append(&initial_hash.as_managed_buffer());

        let hash = self.crypto().keccak256(data);

        sc_print!("hash {}", hash.as_managed_buffer());

        require!(
            self.crypto().verify_ed25519(
                &raw_signature.address.as_managed_buffer(),
                &hash.as_managed_buffer(),
                &raw_signature.signature.as_managed_buffer(),
            ),
            "Signatures out of order"
        );
    }

    fn decimal_to_ascii(&self, mut number: u64) -> ManagedBuffer {
        const MAX_NUMBER_CHARACTERS: usize = 20;
        const ZERO_ASCII: u8 = b'0';

        let mut vec = ArrayVec::<u8, MAX_NUMBER_CHARACTERS>::new();
        loop {
            vec.push(ZERO_ASCII + (number % 10) as u8);
            number /= 10;

            if number == 0 {
                break;
            }
        }

        vec.reverse();
        vec.as_slice().into()
    }

    // map of all prices stored in this contract, key for map is hash of feed name
    // eg for "ETH-USD" feed, key will be keccak256("ETH-USD")
    #[view]
    #[storage_mapper("prices")]
    fn prices(&self, key: &ManagedBuffer) -> SingleValueMapper<PriceData<Self::Api>>;

    #[view]
    #[storage_mapper("required_signatures")]
    fn required_signatures(&self) -> SingleValueMapper<usize>;

    #[view]
    #[storage_mapper("decimals")]
    fn decimals(&self) -> SingleValueMapper<u8>;
}
