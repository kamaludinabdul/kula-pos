import { describe, it, expect } from 'vitest';
import { constructTransactionData } from './transactionLogic';

describe('Transaction Logic', () => {
    const mockUser = { id: 'user1', name: 'Test Cashier' };
    const mockStore = { id: 'store1', name: 'Test Store', taxRate: 10, serviceCharge: 5 };

    it('should construct basic transaction correctly', () => {
        const cart = [
            { id: '1', name: 'Item 1', price: 10000, qty: 2, discount: 0 }
        ];
        const totals = {
            subtotal: 20000,
            tax: 0,
            serviceCharge: 0,
            discountAmount: 0, // No global discount
            finalTotal: 20000
        };

        const result = constructTransactionData({
            cart,
            totals,
            user: mockUser,
            activeStoreId: 'store1',
            paymentMethod: 'cash',
            amountPaid: 20000,
            change: 0,
            store: mockStore
        });

        expect(result.subtotal).toBe(20000); // Gross Total
        expect(result.discount).toBe(0);
        expect(result.total).toBe(20000);
        expect(result.items[0].qty).toBe(2);
    });

    it('should calculate Gross Subtotal and Total Discount correctly with Item Discounts', () => {
        // Scenario: Item 1 price 10000, Discount 1000 (10%). Qty 2.
        // Gross Subtotal should be 10000 * 2 = 20000.
        // Item Discount Total: 1000 * 2 = 2000.
        // Final Total (Net): 18000.

        const cart = [
            { id: '1', name: 'Item 1', price: 10000, qty: 2, discount: 1000 }
        ];
        const totals = {
            subtotal: 18000, // usePOS calculates net subtotal usually
            tax: 0,
            serviceCharge: 0,
            discountAmount: 0, // No EXTRA global discount
            finalTotal: 18000
        };

        const result = constructTransactionData({
            cart,
            totals,
            user: mockUser,
            activeStoreId: 'store1',
            paymentMethod: 'cash',
            amountPaid: 18000,
            change: 0
        });

        expect(result.subtotal).toBe(20000); // CRITICAL: Gross Subtotal
        expect(result.discount).toBe(2000); // 2000 Item Discount
        expect(result.total).toBe(18000);
    });

    it('should aggregate Global Discount + Item Discount', () => {
        // Scenario: 
        // Item 1: 10000 x 1. Item Discount 1000. (Net Item: 9000).
        // Global Discount: 500 (Fixed).
        // Final Total: 8500.

        const cart = [
            { id: '1', name: 'Item 1', price: 10000, qty: 1, discount: 1000 }
        ];

        const totals = {
            subtotal: 8500,
            tax: 0,
            serviceCharge: 0,
            discountAmount: 500, // Global portion
            finalTotal: 8500
        };

        const result = constructTransactionData({
            cart,
            totals,
            user: mockUser,
            activeStoreId: 'store1'
        });

        expect(result.subtotal).toBe(10000); // Gross
        expect(result.discount).toBe(1500); // 1000 (Item) + 500 (Global)
        expect(result.total).toBe(8500);
    });
    it('should return camelCase keys for DataContext compatibility', () => {
        const result = constructTransactionData({
            cart: [],
            totals: { subtotal: 0, tax: 0, serviceCharge: 0, discountAmount: 0, finalTotal: 0 },
            user: mockUser,
            activeStoreId: 'store1',
            paymentMethod: 'cash',
            amountPaid: 0,
            change: 0
        });

        expect(result).toHaveProperty('paymentMethod');
        expect(result).toHaveProperty('amountPaid');
        expect(result).toHaveProperty('cashierId');
        expect(result).toHaveProperty('cashier'); // Not cashier_name
        expect(result).not.toHaveProperty('payment_method');
        expect(result).not.toHaveProperty('amount_paid');
    });
});
