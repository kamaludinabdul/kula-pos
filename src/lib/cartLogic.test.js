import { describe, it, expect } from 'vitest';
import { calculateCartTotals, calculateChange } from './cartLogic';

describe('Cart Logic', () => {
    describe('calculateCartTotals', () => {
        it('should calculate basic subtotal correctly', () => {
            const cart = [
                { price: 10000, qty: 2 },
                { price: 5000, qty: 1 }
            ];
            const result = calculateCartTotals(cart, null, 0);
            expect(result.subtotal).toBe(25000);
            expect(result.finalTotal).toBe(25000);
        });

        it('should apply percentage discount correctly', () => {
            const cart = [{ price: 100000, qty: 1 }];
            const result = calculateCartTotals(cart, 'percentage', 10); // 10%
            expect(result.subtotal).toBe(100000);
            expect(result.discountAmount).toBe(10000);
            expect(result.finalTotal).toBe(90000);
        });

        it('should apply fixed discount correctly', () => {
            const cart = [{ price: 100000, qty: 1 }];
            const result = calculateCartTotals(cart, 'amount', 15000);
            expect(result.discountAmount).toBe(15000);
            expect(result.finalTotal).toBe(85000);
        });

        it('should cap discount at subtotal', () => {
            const cart = [{ price: 5000, qty: 1 }];
            const result = calculateCartTotals(cart, 'amount', 10000); // Exceeds subtotal
            expect(result.discountAmount).toBe(5000);
            expect(result.finalTotal).toBe(0);
        });

        it('should calculate exclusive tax correctly', () => {
            // Price: 100,000
            // Discount: 10,000 (10%)
            // TaxBase: 90,000
            // Tax (10%): 9,000
            // Service (5%): 4,500
            // Total: 103,500
            const cart = [{ price: 100000, qty: 1 }];
            const result = calculateCartTotals(cart, 'percentage', 10, 10, 5, 'exclusive');
            expect(result.taxBase).toBe(90000);
            expect(result.taxAmount).toBe(9000);
            expect(result.serviceCharge).toBe(4500);
            expect(result.finalTotal).toBe(103500);
        });

        it('should calculate inclusive tax correctly', () => {
            // Price: 110,000 (Includes 10% Tax) -> Base ≈ 100,000
            // Discount: 0
            // Expected TaxBase + Tax = 110,000
            // Tax = 110000 - (110000 / 1.1) = 10,000
            // Base = 100,000
            // Service (5% of Gross 110k): 5,500
            // Final Total: 110,000 + 5,500 = 115,500

            const cart = [{ price: 110000, qty: 1 }];
            const result = calculateCartTotals(cart, null, 0, 10, 5, 'inclusive');

            expect(result.subtotal).toBe(110000);
            expect(Math.round(result.taxAmount)).toBe(10000);
            expect(Math.round(result.taxBase)).toBe(100000);
            expect(result.serviceCharge).toBe(5500);
            expect(result.finalTotal).toBe(115500);
        });
    });

    describe('calculateChange', () => {
        it('should calculate correct change', () => {
            expect(calculateChange(50000, 100000)).toBe(50000);
            expect(calculateChange(50000, 50000)).toBe(0);
        });

        it('should return 0 if underpaid', () => {
            expect(calculateChange(50000, 40000)).toBe(0);
        });
    });
});
