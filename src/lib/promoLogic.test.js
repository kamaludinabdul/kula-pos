import { describe, it, expect } from 'vitest';
import { calculateActivePromotions } from './promoLogic';

describe('calculateActivePromotions', () => {
    const mockProducts = [
        { id: '1', name: 'Product A', sellPrice: 10000 },
        { id: '2', name: 'Product B', sellPrice: 20000 }
    ];

    it('should calculate bundle discount correctly', () => {
        const promotions = [{
            id: 'p1',
            type: 'bundle',
            targetIds: ['1', '2'],
            value: 25000, // Bundle price for both
            isActive: true
        }];
        const cart = [
            { id: '1', qty: 1, price: 10000 },
            { id: '2', qty: 1, price: 20000 }
        ];
        const result = calculateActivePromotions(promotions, cart, 30000, mockProducts);

        // Normal price: 10k + 20k = 30k. Bundle: 25k. Promo discount: 5k.
        expect(result[0].isApplicable).toBe(true);
        expect(result[0].potentialDiscount).toBe(5000);
    });

    it('should apply bundle multiples if allowed', () => {
        const promotions = [{
            id: 'p1',
            type: 'bundle',
            targetIds: ['1'],
            value: 8000, // Normally 10000
            isActive: true,
            allowMultiples: true
        }];
        const cart = [{ id: '1', qty: 3, price: 10000 }];
        const result = calculateActivePromotions(promotions, cart, 30000, mockProducts);

        // Multiplier 3 * (10000 - 8000) = 6000
        expect(result[0].potentialDiscount).toBe(6000);
    });

    it('should respect minPurchase for percentage promos', () => {
        const promotions = [{
            id: 'p2',
            type: 'percentage',
            value: 10,
            minPurchase: 50000,
            isActive: true
        }];
        const cart = [{ id: '1', qty: 4, price: 10000 }]; // 40000 total

        const result = calculateActivePromotions(promotions, cart, 40000, mockProducts);
        expect(result[0].isApplicable).toBe(false);

        const result2 = calculateActivePromotions(promotions, [{ id: '1', qty: 6, price: 10000 }], 60000, mockProducts);
        expect(result2[0].isApplicable).toBe(true);
        expect(result2[0].potentialDiscount).toBe(6000);
    });

    it('should report missing items for incomplete bundles', () => {
        const promotions = [{
            id: 'p1',
            type: 'bundle',
            targetIds: ['1', '2'],
            isActive: true
        }];
        const cart = [{ id: '1', qty: 1, price: 10000 }];
        const result = calculateActivePromotions(promotions, cart, 10000, mockProducts);

        expect(result[0].isApplicable).toBe(false);
        expect(result[0].missingItems).toContain('2');
    });

    it('should support discountValue property as fallback for value', () => {
        const promotions = [{
            id: 'p1',
            type: 'bundle',
            targetIds: ['1', '2'],
            discountValue: 25000, // Using discountValue instead of value
            isActive: true
        }];
        const cart = [
            { id: '1', qty: 1, price: 10000 },
            { id: '2', qty: 1, price: 20000 }
        ];
        const result = calculateActivePromotions(promotions, cart, 30000, mockProducts);

        expect(result[0].isApplicable).toBe(true);
        expect(result[0].potentialDiscount).toBe(5000);
    });
    it('should apply product-specific percentage discount correctly', () => {
        const promotions = [{
            id: 'p-spec',
            type: 'percentage',
            targetIds: ['1'],
            value: 10,
            isActive: true
        }];
        const cart = [
            { id: '1', qty: 2, price: 10000 }, // 20000 total for target
            { id: '2', qty: 1, price: 20000 }
        ];
        const result = calculateActivePromotions(promotions, cart, 40000, mockProducts);

        // Should only be 10% of 20000 (Product 1), which is 2000.
        // Previously it would be 10% of 40000 (4000).
        expect(result[0].isApplicable).toBe(true);
        expect(result[0].potentialDiscount).toBe(2000);
    });

    it('should NOT apply product-specific discount if product is not in cart', () => {
        const promotions = [{
            id: 'p-spec',
            type: 'percentage',
            targetIds: ['1'],
            value: 10,
            isActive: true
        }];
        const cart = [
            { id: '2', qty: 1, price: 20000 }
        ];
        const result = calculateActivePromotions(promotions, cart, 20000, mockProducts);

        expect(result[0].isApplicable).toBe(false);
        expect(result[0].potentialDiscount).toBe(0);
    });

    it('should apply product-specific fixed discount multiples if allowed', () => {
        const promotions = [{
            id: 'p-fixed',
            type: 'fixed',
            targetIds: ['1'],
            value: 5000, 
            minPurchase: 10000,
            isActive: true,
            allowMultiples: true
        }];
        const cart = [
            { id: '1', qty: 3, price: 10000 }, // 30000 total for target
            { id: '2', qty: 1, price: 20000 }
        ];
        const result = calculateActivePromotions(promotions, cart, 50000, mockProducts);

        // 30000 / 10000 = 3 sets. 3 * 5000 = 15000 discount.
        expect(result[0].isApplicable).toBe(true);
        expect(result[0].potentialDiscount).toBe(15000);
    });
});
