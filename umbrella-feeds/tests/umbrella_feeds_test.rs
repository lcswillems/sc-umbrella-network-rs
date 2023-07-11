use multiversx_sc::types::{Address, ManagedBuffer, ManagedByteArray, MultiValueManagedVec};
use multiversx_sc_scenario::{managed_address, rust_biguint, testing_framework::{BlockchainStateWrapper, ContractObjWrapper}, DebugApi, managed_buffer, managed_biguint};
use multiversx_sc::hex_literal::hex;

use umbrella_feeds::{ UmbrellaFeeds };
use umbrella_feeds::structs::{PriceData, Signature};
use staking_bank_static_local::{ StakingBank };

pub struct UmbrellaFeedsSetup<UmbrellaFeedsObjectBuilder, StakingFactoryObjectBuilder>
    where
        UmbrellaFeedsObjectBuilder: 'static + Copy + Fn() -> umbrella_feeds::ContractObj<DebugApi>,
        StakingFactoryObjectBuilder: 'static + Copy + Fn() -> staking_bank_static_local::ContractObj<DebugApi>,
{
    pub b_mock: BlockchainStateWrapper,
    pub owner_address: Address,
    pub contract_wrapper: ContractObjWrapper<umbrella_feeds::ContractObj<DebugApi>, UmbrellaFeedsObjectBuilder>,
    pub staking_bank_wrapper: ContractObjWrapper<staking_bank_static_local::ContractObj<DebugApi>, StakingFactoryObjectBuilder>,
}


impl<UmbrellaFeedsObjectBuilder, StakingFactoryObjectBuilder> UmbrellaFeedsSetup<UmbrellaFeedsObjectBuilder, StakingFactoryObjectBuilder> where
    UmbrellaFeedsObjectBuilder: 'static + Copy + Fn() -> umbrella_feeds::ContractObj<DebugApi>,
    StakingFactoryObjectBuilder: 'static + Copy + Fn() -> staking_bank_static_local::ContractObj<DebugApi>,
{
    pub fn new(
        contract_builder: UmbrellaFeedsObjectBuilder,
        staking_factory_contract_builder: StakingFactoryObjectBuilder,
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

        let staking_bank_wrapper = b_mock.create_sc_account(
            &rust_zero,
            Option::Some(&owner_address),
            staking_factory_contract_builder,
            "../../staking-bank-static/staking-bank-static-local/output/staking-bank.wasm",
        );

        let _ = DebugApi::dummy();

        b_mock
            .execute_tx(&owner_address, &staking_bank_wrapper, &rust_zero, |sc| {
                sc.init();
            })
            .assert_ok();

        b_mock
            .execute_tx(&owner_address, &contract_wrapper, &rust_zero, |sc| {
                sc.init(managed_address!(staking_bank_wrapper.address_ref()), 1, 8);
            })
            .assert_ok();

        UmbrellaFeedsSetup {
            b_mock,
            owner_address,
            contract_wrapper,
            staking_bank_wrapper,
        }
    }
}

#[test]
fn update_valid_signature() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVec::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVec::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVec::<DebugApi, Signature<DebugApi>>::new();

        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            data: 0,
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            signature: ManagedByteArray::from(&hex!("89657df3e35a4f34c758ea228c1cb6fc4789c109b04d0cbd7d562483de8a640a4a18a07f6f772ce53ab868d4fa0509c7ff2934b08fd93dd35f4784963453610f")),
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_ok();

    println!("something something {:?}", fc_setup.contract_wrapper.address_ref());
}
