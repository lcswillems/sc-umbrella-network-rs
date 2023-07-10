#![no_std]

multiversx_sc::imports!();

use crate::structs::Validator;

pub mod structs;
pub mod events;

#[multiversx_sc::module]
pub trait StakingBankModule: events::StakingBankEventsModule {
    #[only_owner]
    #[endpoint]
    fn create(&self, id: ManagedAddress, location: ManagedBuffer) {
        require!(self.validators(&id).is_empty(), "Validator already exists");

        self.addresses().push(&id);

        self.validator_registered_event(&id);

        self.validators(&id).set(Validator {
            id,
            location,
        });
    }

    #[only_owner]
    #[endpoint]
    fn remove(&self, id: ManagedAddress) {
        require!(!self.validators(&id).is_empty(), "Validator not exists");

        self.validators(&id).clear();

        self.validator_removed_event(&id);

        for index in 1..=self.addresses().len() {
            if self.addresses().get(index) == id {
                self.addresses().swap_remove(index);
                break;
            }
        }
    }

    #[only_owner]
    #[endpoint]
    fn update(&self, id: ManagedAddress, location: ManagedBuffer) {
        require!(!self.validators(&id).is_empty(), "Validator not exists");

        self.validators(&id).update(|validator| validator.location = location);

        self.validator_updated_event(&id);
    }

    #[view(getNumberOfValidators)]
    fn get_number_of_validators(&self) -> usize {
        self.addresses().len()
    }

    #[view(isValidator)]
    fn is_validator(&self, id: ManagedAddress) -> bool {
        !self.validators(&id).is_empty()
    }

    #[view(verifyValidators)]
    fn verify_validators(&self, validators: MultiValueEncoded<ManagedAddress>) -> bool {
        for id in validators.into_iter() {
            if !self.is_validator(id) {
                return false;
            }
        }

        return true;
    }

    #[view]
    #[storage_mapper("validators")]
    fn validators(&self, address: &ManagedAddress) -> SingleValueMapper<Validator<Self::Api>>;

    #[view]
    #[storage_mapper("addresses")]
    fn addresses(&self) -> VecMapper<ManagedAddress>;
}
