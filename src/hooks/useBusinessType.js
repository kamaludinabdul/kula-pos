import { useData } from '../context/DataContext';
import { BUSINESS_TYPES } from '../config/businessTypes';

export function useBusinessType() {
    const { currentStore } = useData();
    // Default to 'general' if business_type is null or missing
    const type = currentStore?.business_type || 'general';

    // Safely fallback to general config if somehow the type is not found in our definitions
    const config = BUSINESS_TYPES[type] || BUSINESS_TYPES.general;

    return {
        type,                           // Returns string: 'fnb', 'pharmacy', etc.
        config,                         // The full configuration object

        // Helper methods for clean logic gates
        hasFeature: (feat) => config.features.includes(feat),
        term: (key) => config.terminology[key] || key,
        showField: (field) => config.productFields.includes(field),
        setting: (key) => config.settings[key],

        // Convenience boolean flags
        isGeneral: type === 'general',
        isFnB: type === 'fnb',
        isPharmacy: type === 'pharmacy',
        isLaundry: type === 'laundry',
        isRental: type === 'rental',
        isPetClinic: type === 'pet_clinic'
    };
}
