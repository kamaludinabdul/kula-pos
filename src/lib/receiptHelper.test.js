import { describe, it, expect } from 'vitest';
import { generateReceiptHtml } from './receiptHelper';

describe('Receipt Helper', () => {
    const mockStore = {
        name: 'My Store',
        address: '123 Main St',
        phone: '08123456789',
        receiptHeader: 'Welcome!',
        receiptFooter: 'Thank You!',
        printerPaperSize: '58mm'
    };

    const mockTransaction = {
        id: 'TX123',
        date: '2023-01-01T10:00:00Z',
        cashier: 'John',
        items: [
            { name: 'Item A', price: 10000, qty: 1, discount: 0 },
            { name: 'Item B', price: 20000, qty: 2, discount: 5000 } // 20k * 2 = 40k. Discount 5k * 2 = 10k. Final 30k.
        ],
        subtotal: 50000, // Gross: 10k + 40k = 50k
        discount: 10000, // Item B discount
        total: 40000,
        paymentMethod: 'cash',
        amountPaid: 50000,
        change: 10000
    };

    it('should generate valid HTML', () => {
        const html = generateReceiptHtml(mockTransaction, mockStore);
        expect(html).toContain('<html>');
        expect(html).toContain('My Store');
        expect(html).toContain('TX123');
    });

    it('should display item discount correctly', () => {
        const html = generateReceiptHtml(mockTransaction, mockStore);

        // Item B Check
        // Should show original price crossed out
        // 20000 * 2 = 40000
        expect(html).toContain('40.000'); // Original Total
        expect(html).toContain('text-decoration: line-through');

        // Should show discount row
        expect(html).toContain('Diskon');
        expect(html).toContain('-10.000'); // 5000 * 2

        // Should show final item total
        expect(html).toContain('30.000');
    });

    it('should display totals section correctly', () => {
        const html = generateReceiptHtml(mockTransaction, mockStore);

        // Subtotal (GROSS)
        expect(html).toContain('Subtotal');
        expect(html).toContain('50.000');

        // Total Discount
        expect(html).toContain('Diskon');
        expect(html).toContain('- Rp 10.000');

        // Final Total
        expect(html).toContain('TOTAL');
        expect(html).toContain('40.000');
    });
});
