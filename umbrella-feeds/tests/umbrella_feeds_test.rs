use multiversx_sc::types::{Address, ManagedBuffer, ManagedByteArray, MultiValueManagedVecCounted};
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
        required_signatures: usize,
        init_staking_bank: bool,
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

        if init_staking_bank {
            b_mock
                .execute_tx(&owner_address, &staking_bank_wrapper, &rust_zero, |sc| {
                    sc.init();
                })
                .assert_ok();
        }

        b_mock
            .execute_tx(&owner_address, &contract_wrapper, &rust_zero, |sc| {
                sc.init(managed_address!(staking_bank_wrapper.address_ref()), required_signatures, 8);
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
        1,
        true,
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        // ETH-USD hashed using keccak256
        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("611cf1e57a59c15317c177963bf555e368d61506032b69ca4d42094bed662a77aafc7cacdffe404be16444e5e8ccc0082b60ec0f98ac217b75e83a3ff5ea1d09")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_ok();

    fc_setup.b_mock.execute_query(&fc_setup.contract_wrapper, |sc| {
        let price_data: PriceData<DebugApi> = sc.get_price_data_by_name(managed_buffer!(b"ETH-USD"));

        assert_eq!(price_data.heartbeat, 0);
        assert_eq!(price_data.timestamp, 1688998114);
        assert_eq!(price_data.price, managed_biguint!(1000000000u64));
    }).assert_ok();

    // Can not update with same data twice
    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        // ETH-USD hashed using keccak256
        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("611cf1e57a59c15317c177963bf555e368d61506032b69ca4d42094bed662a77aafc7cacdffe404be16444e5e8ccc0082b60ec0f98ac217b75e83a3ff5ea1d09")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_user_error("Old data");
}

#[test]
fn update_not_enough_signatures() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        2,
        true
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("611cf1e57a59c15317c177963bf555e368d61506032b69ca4d42094bed662a77aafc7cacdffe404be16444e5e8ccc0082b60ec0f98ac217b75e83a3ff5ea1d09")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_user_error("Not enough signatures");
}

#[test]
fn update_signatures_out_of_order() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        1,
        true
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(2000000000u64), // wrong price
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("611cf1e57a59c15317c177963bf555e368d61506032b69ca4d42094bed662a77aafc7cacdffe404be16444e5e8ccc0082b60ec0f98ac217b75e83a3ff5ea1d09")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_user_error("Signatures out of order");
}

#[test]
fn update_invalid_signer() {
    let rust_zero = rust_biguint!(0u64);
    let mut fc_setup = UmbrellaFeedsSetup::new(
        umbrella_feeds::contract_obj,
        staking_bank_static_local::contract_obj,
        1,
        false // signer not known by staking bank
    );

    fc_setup.b_mock.execute_tx(&fc_setup.owner_address, &fc_setup.contract_wrapper, &rust_zero, |sc| {
        let mut price_keys = MultiValueManagedVecCounted::<DebugApi, ManagedBuffer<DebugApi>>::new();
        let mut price_datas = MultiValueManagedVecCounted::<DebugApi, PriceData<DebugApi>>::new();
        let mut signatures = MultiValueManagedVecCounted::<DebugApi, Signature<DebugApi>>::new();

        price_keys.push(managed_buffer!(&hex!("2430f68ea2e8d4151992bb7fc3a4c472087a6149bf7e0232704396162ab7c1f7")));

        price_datas.push(PriceData {
            heartbeat: 0,
            timestamp: 1688998114,
            price: managed_biguint!(1000000000u64),
        });

        signatures.push(Signature {
            address: managed_address!(&Address::from(hex!("0139472eff6886771a982f3083da5d421f24c29181e63888228dc81ca60d69e1"))),
            signature: ManagedByteArray::from(&hex!("611cf1e57a59c15317c177963bf555e368d61506032b69ca4d42094bed662a77aafc7cacdffe404be16444e5e8ccc0082b60ec0f98ac217b75e83a3ff5ea1d09")),
        });

        sc.update(price_keys, price_datas, signatures);
    })
        .assert_user_error("Invalid signer");
}
