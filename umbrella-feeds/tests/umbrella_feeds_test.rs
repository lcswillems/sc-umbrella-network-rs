use multiversx_sc::types::{Address, ManagedBuffer, MultiValueManagedVec};
use multiversx_sc_scenario::{managed_address, rust_biguint, testing_framework::{BlockchainStateWrapper, ContractObjWrapper}, DebugApi, managed_buffer, managed_biguint};

use umbrella_feeds::{ UmbrellaFeeds };
use umbrella_feeds::structs::{PriceData, Signature};

pub struct UmbrellaFeedsSetup<UmbrellaFeedsObjectBuilder>
    where
        UmbrellaFeedsObjectBuilder: 'static + Copy + Fn() -> umbrella_feeds::ContractObj<DebugApi>,
{
    pub b_mock: BlockchainStateWrapper,
    pub owner_address: Address,
    pub contract_wrapper: ContractObjWrapper<umbrella_feeds::ContractObj<DebugApi>, UmbrellaFeedsObjectBuilder>,
}


impl<UmbrellaFeedsObjectBuilder> UmbrellaFeedsSetup<UmbrellaFeedsObjectBuilder> where
    UmbrellaFeedsObjectBuilder: 'static + Copy + Fn() -> umbrella_feeds::ContractObj<DebugApi>,
{
    pub fn new(
        contract_builder: UmbrellaFeedsObjectBuilder,
    ) -> Self {
        let rust_zero = rust_biguint!(0u64);
        let mut b_mock = BlockchainStateWrapper::new();
        let owner_address = b_mock.create_user_account(&rust_zero);

        let contract_wrapper = b_mock.create_sc_account(
            &rust_zero,
            Option::Some(&owner_address),
            contract_builder,
            "output/umbrella-feeds.wasm",
        );

        let _ = DebugApi::dummy();

        b_mock
            .execute_tx(&owner_address, &contract_wrapper, &rust_zero, |sc| {
                sc.init(managed_address!(&owner_address.clone()), 1, 8);
            })
            .assert_ok();

        UmbrellaFeedsSetup {
            b_mock,
            owner_address,
            contract_wrapper,
        }
    }
}

#[test]
fn signature() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVec::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVec::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVec::<DebugApi, Signature<DebugApi>>::new();

        price_keys.push(managed_buffer!(b"2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7"));

        price_datas.push(PriceData {
            data: 0,
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            v: 27,
            r: managed_buffer!(b"db3b6308d733260e5d3a5f40066910e9a85ae7c2fdf2694fd0c48a5d575fa649"),
            s: managed_buffer!(b"256d7641f97dbd648e1db679d6c9780028c07194a878f3c2c3773d24c42060af"),

            key: managed_buffer!(b"02186c81b93f84eb8a8a31d39a9ce01f0cc5426fba0e11bf165ce62d237881d21e"),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_ok();

    println!("something something {:?}", fc_setup.contract_wrapper.address_ref());
}
