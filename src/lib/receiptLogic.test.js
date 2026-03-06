import { describe, it, expect } from 'vitest';
import { prepareReceiptData } from './receiptLogic';

describe('prepareReceiptData', () => {
    const mockTransaction = {
        id: 'tx_123',
        subtotal: 100000,
        total: 105000,
        tax: 5000,
        serviceCharge: 0,
        discount: 0,
        amountPaid: 110000,
        change: 5000,
        items: [
            { id: 'p1', name: 'Product 1', price: 50000, qty: 2, discount: 0 }
        ]
    };

    it('should calculate item totals correctly', () => {
        const result = prepareReceiptData(mockTransaction);
        expect(result.items[0].originalTotal).toBe(100000);
        expect(result.items[0].finalItemTotal).toBe(100000);
        expect(result.totalQty).toBe(2);
    });

    it('should calculate item totals with item-level discounts', () => {
        const txWithDiscount = {
            ...mockTransaction,
            items: [
                { id: 'p1', name: 'Product 1', price: 50000, qty: 2, discount: 5000 }
            ]
        };
        const result = prepareReceiptData(txWithDiscount);
        expect(result.items[0].originalTotal).toBe(100000);
        expect(result.items[0].itemDiscountValue).toBe(10000); // 2 * 5000
        expect(result.items[0].finalItemTotal).toBe(90000);
    });

    it('should map flat values correctly', () => {
        const result = prepareReceiptData(mockTransaction);
        expect(result.subtotal).toBe(100000);
        expect(result.tax).toBe(5000);
        expect(result.finalTotal).toBe(105000);
        expect(result.change).toBe(5000);
    });

    it('should default to total if subtotal is missing', () => {
        const txNoSubtotal = { ...mockTransaction, subtotal: undefined };
        const result = prepareReceiptData(txNoSubtotal);
        expect(result.subtotal).toBe(105000);
    });
});
