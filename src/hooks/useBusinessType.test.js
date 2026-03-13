import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBusinessType } from './useBusinessType';
import { useData } from '../context/DataContext';

// Mock the DataContext
vi.mock('../context/DataContext', () => ({
    useData: vi.fn()
}));

// Mock the util that hasFeatureAccess uses (if needed)
vi.mock('../utils/plans', () => ({
    hasFeatureAccess: vi.fn(() => true) // Default to true for simplicity in basic tests
}));

describe('useBusinessType Hook', () => {
    it('should fall back to general when no store is active', () => {
        vi.mocked(useData).mockReturnValue({ currentStore: null, plans: [] });
        
        const { result } = renderHook(() => useBusinessType());
        
        expect(result.current.type).toBe('general');
        expect(result.current.term('product')).toBe('Barang');
        expect(result.current.isGeneral).toBe(true);
    });

    it('should return pharmacy terminology and features for pharmacy type', () => {
        vi.mocked(useData).mockReturnValue({ 
            currentStore: { business_type: 'pharmacy' }, 
            plans: [] 
        });

        const { result } = renderHook(() => useBusinessType());

        expect(result.current.type).toBe('pharmacy');
        expect(result.current.isPharmacy).toBe(true);
        expect(result.current.term('product')).toBe('Obat');
        expect(result.current.term('customer')).toBe('Pasien');
        expect(result.current.hasFeature('prescriptions')).toBe(true);
        expect(result.current.setting('enableExpiryTracking')).toBe(true);
    });

    it('should return correct terminology for fnb type', () => {
        vi.mocked(useData).mockReturnValue({ 
            currentStore: { business_type: 'fnb' }, 
            plans: [] 
        });

        const { result } = renderHook(() => useBusinessType());

        expect(result.current.type).toBe('fnb');
        expect(result.current.term('product')).toBe('Menu');
        expect(result.current.term('sale')).toBe('Pesanan');
    });

    it('should correctly gate setting-based features', () => {
        // Pharmacy has expiry tracking enabled by default in config
        vi.mocked(useData).mockReturnValue({ 
            currentStore: { business_type: 'pharmacy' }, 
            plans: [] 
        });
        const pharmacy = renderHook(() => useBusinessType()).result.current;
        expect(pharmacy.setting('enableExpiryTracking')).toBe(true);

        // General (Toko) does NOT have it
        vi.mocked(useData).mockReturnValue({ 
            currentStore: { business_type: 'general' }, 
            plans: [] 
        });
        const general = renderHook(() => useBusinessType()).result.current;
        expect(general.setting('enableExpiryTracking')).toBeUndefined();
    });

    it('should verify field visibility based on config', () => {
        vi.mocked(useData).mockReturnValue({ 
            currentStore: { business_type: 'pharmacy' }, 
            plans: [] 
        });
        const { result } = renderHook(() => useBusinessType());
        
        expect(result.current.showField('is_prescription_required')).toBe(true);
        expect(result.current.showField('recipe')).toBe(false); // only in fnb
    });
});
