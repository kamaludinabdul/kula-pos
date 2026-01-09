import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePOS } from './usePOS';
import { useData } from '../context/DataContext';

// Mock dependencies
const mockProducts = [
    { id: '1', name: 'Product 1', price: 10000, stock: 10, category: 'Food' },
    { id: '2', name: 'Product 2', price: 5000, stock: 5, category: 'Drink' }
];

const mockCurrentStore = {
    id: 'store1',
    taxRate: 10,
    serviceCharge: 5,
    taxType: 'exclusive'
};

vi.mock('../context/DataContext', () => ({
    useData: vi.fn(() => ({
        products: mockProducts,
        categories: ['Food', 'Drink'],
        transactions: [],
        currentStore: mockCurrentStore,
        customers: [],
        promotions: []
    }))
}));

vi.mock('../context/ShiftContext', () => ({
    useShift: () => ({
        currentShift: { id: 'shift1' }
    })
}));

// Mock utils
vi.mock('../utils/smartCashier', () => ({
    calculateAssociations: () => ({}),
    getSmartRecommendations: () => []
}));

vi.mock('../firebase', () => ({
    db: {}
}));

describe('usePOS Hook', () => {
    it('should initialize with empty cart', () => {
        const { result } = renderHook(() => usePOS());
        expect(result.current.cart).toEqual([]);
        expect(result.current.totals.finalTotal).toBe(0);
    });

    it('should add items to cart', () => {
        const { result } = renderHook(() => usePOS());

        act(() => {
            result.current.addToCart(mockProducts[0]);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].id).toBe('1');
        expect(result.current.cart[0].qty).toBe(1);
        expect(result.current.cart[0].price).toBe(10000);
    });

    it('should increment quantity when adding existing item', () => {
        const { result } = renderHook(() => usePOS());

        act(() => {
            result.current.addToCart(mockProducts[0]);
        });
        act(() => {
            result.current.addToCart(mockProducts[0]);
        });

        expect(result.current.cart).toHaveLength(1);
        expect(result.current.cart[0].qty).toBe(2);
    });

    it('should calculate totals correctly (exclusive tax)', () => {
        const { result } = renderHook(() => usePOS());

        act(() => {
            result.current.addToCart(mockProducts[0]); // 10000
        });

        const { totals } = result.current;
        // Subtotal: 10000
        // Tax 10%: 1000
        // Service 5%: 500
        // Total: 11500
        expect(totals.subtotal).toBe(10000);
        expect(totals.tax).toBe(1000);
        expect(totals.serviceCharge).toBe(500);
        expect(totals.finalTotal).toBe(11500);
    });

    it('should apply discount correctly', () => {
        const { result } = renderHook(() => usePOS());

        act(() => {
            result.current.addToCart(mockProducts[0]);
        });

        act(() => {
            result.current.setDiscountValue(10); // 10%
            result.current.setDiscountType('percentage');
        });

        // Raw: 10000
        // Discount: 1000
        // After Discount: 9000
        // Tax 10% of 9000: 900
        // Service 5% of 9000: 450
        // Total: 10350

        expect(result.current.totals.discountAmount).toBe(1000);
        expect(result.current.totals.subtotal).toBe(9000);
        expect(result.current.totals.tax).toBe(900);
        expect(result.current.totals.finalTotal).toBe(10350);
    });

    it('should clear cart', () => {
        const { result } = renderHook(() => usePOS());

        act(() => {
            result.current.addToCart(mockProducts[0]);
            result.current.clearCart();
        });

        expect(result.current.cart).toEqual([]);
        expect(result.current.totals.finalTotal).toBe(0);
    });

    // --- PROMO ENGINE TESTS ---
    it('should detect applicable bundle promotion', () => {
        // Mock promotions
        vi.mocked(useData).mockReturnValue({
            products: mockProducts,
            categories: ['Food', 'Drink'],
            transactions: [],
            currentStore: mockCurrentStore,
            customers: [],
            promotions: [
                {
                    id: 'promo1',
                    title: 'Bundle 1',
                    type: 'bundle',
                    targetIds: ['1'], // Product 1
                    value: 2000, // Bundle discount amount (saving)
                    isActive: true,
                    usageLimit: 0
                }
            ]
        });

        const { result } = renderHook(() => usePOS());

        act(() => {
            result.current.addToCart(mockProducts[0]); // Add Product 1 (Price 10000)
        });

        // Check if promo is available
        expect(result.current.availablePromos).toHaveLength(1);
        expect(result.current.availablePromos[0].id).toBe('promo1');
        // Potential Discount = Price - Value? No, logic was relevantItemsTotal - value.
        // Wait, in usePOS logic: potentialDiscount = relevantItemsTotal - promo.value
        // If promo.value is the BUNDLE PRICE (e.g. pay 8000 for 10000 item), then potentialDiscount = 10000 - 8000 = 2000.
        // My mock says value: 2000.
        // If value represents the FINAL PRICE, then 10000 - 2000 = 8000 discount? That's weird.
        // Let's check logic: potentialDiscount = relevantItemsTotal - promo.value;
        // So promo.value IS the BUNDLE PRICE. CORRECT.
    });
    it('should calculate bundle multiples correctly', () => {
        vi.mocked(useData).mockReturnValue({
            products: mockProducts,
            categories: ['Food', 'Drink'],
            transactions: [],
            currentStore: mockCurrentStore,
            customers: [],
            promotions: [
                {
                    id: 'promo-bundle-multi',
                    title: 'Bundle Multi',
                    type: 'bundle',
                    targetIds: ['1'], // Product 1 (10000)
                    value: 8000, // Bundle Price (Saving 2000 per item)
                    isActive: true,
                    usageLimit: 0,
                    allowMultiples: true
                }
            ]
        });

        const { result } = renderHook(() => usePOS());

        // Add 3 items. Should be 3 sets.
        // Normal Price: 30000.
        // Bundle Price for 3: 24000.
        // Discount: 6000.

        act(() => {
            result.current.addToCart(mockProducts[0]);
            result.current.addToCart(mockProducts[0]);
            result.current.addToCart(mockProducts[0]);
        });

        const promo = result.current.availablePromos.find(p => p.id === 'promo-bundle-multi');
        expect(promo).toBeDefined();

        // potentialDiscount = (10000 - 8000) * 3 = 6000
        expect(promo.potentialDiscount).toBe(6000);
    });
});
