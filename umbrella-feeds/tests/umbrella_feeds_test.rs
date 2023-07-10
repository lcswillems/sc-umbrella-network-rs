use multiversx_sc::types::{Address, ManagedBuffer, MultiValueManagedVec};
use multiversx_sc_scenario::{
    managed_address, rust_biguint,
    testing_framework::{BlockchainStateWrapper, ContractObjWrapper},
    DebugApi,
};

use umbrella_feeds::{ UmbrellaFeeds };

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
        let mut vec = MultiValueManagedVec::<DebugApi, ManagedBuffer<DebugApi>>::new();


    })
        .assert_ok();

    println!("something something {:?}", fc_setup.contract_wrapper.address_ref());
}
