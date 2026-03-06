import { describe, it, expect } from 'vitest';
import { calculateCartTotals, calculateChange, calculateWholesaleUnitPrice } from './cartLogic';

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
            const cart = [{ price: 100000, qty: 1 }];
            const result = calculateCartTotals(cart, 'percentage', 10, 10, 5, 'exclusive');
            expect(result.taxBase).toBe(90000);
            expect(result.taxAmount).toBe(9000);
            expect(result.serviceCharge).toBe(4500);
            expect(result.finalTotal).toBe(103500);
        });

        it('should calculate inclusive tax correctly', () => {
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

    describe('calculateWholesaleUnitPrice', () => {
        const product = {
            id: 'p1',
            price: 10000,
            isWholesale: true,
            pricingTiers: [
                { duration: 5, price: 9000 },
                { duration: 10, price: 8000 }
            ]
        };

        it('should apply wholesale threshold price for all units', () => {
            expect(calculateWholesaleUnitPrice(product, 1)).toBe(10000);
            expect(calculateWholesaleUnitPrice(product, 5)).toBe(9000);
            expect(calculateWholesaleUnitPrice(product, 8)).toBe(9000);
            expect(calculateWholesaleUnitPrice(product, 12)).toBe(8000);
        });

        it('should calculate bundling step-wise price (average per unit)', () => {
            const bundleProduct = {
                ...product,
                isWholesale: false,
                pricingTiers: [
                    { duration: 5, price: 40000 },
                ]
            };
            expect(calculateWholesaleUnitPrice(bundleProduct, 3)).toBe(10000);
            expect(calculateWholesaleUnitPrice(bundleProduct, 5)).toBe(8000);
            const result7 = calculateWholesaleUnitPrice(bundleProduct, 7);
            expect(Math.round(result7)).toBe(Math.round(60000 / 7));
        });

        it('should handle complex multi-tier bundling', () => {
            const complexBundle = {
                price: 100,
                isWholesale: false,
                pricingTiers: [
                    { duration: 10, price: 800 },
                    { duration: 5, price: 450 }
                ]
            };
            expect(calculateWholesaleUnitPrice(complexBundle, 16)).toBe(1350 / 16);
        });
    });
});
