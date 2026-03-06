import { describe, it, expect } from 'vitest';
import { calculateFIFOReduction, calculateStockDifference, calculateStockDifferenceValue } from './stockLogic';

describe('calculateFIFOReduction', () => {
    it('should reduce stock from a single batch', () => {
        const batches = [
            { id: 1, stock: 10, buy_price: 1000, created_at: '2024-01-01' }
        ];
        const { updatedBatches, totalCOGS, remainingQty } = calculateFIFOReduction(batches, 5);

        expect(updatedBatches[0].stock).toBe(5);
        expect(totalCOGS).toBe(5000);
        expect(remainingQty).toBe(0);
    });

    it('should reduce stock across multiple batches (FIFO)', () => {
        const batches = [
            { id: 2, stock: 10, buy_price: 1200, created_at: '2024-01-02' },
            { id: 1, stock: 10, buy_price: 1000, created_at: '2024-01-01' }, // Oldest
        ];
        const { updatedBatches, totalCOGS, remainingQty } = calculateFIFOReduction(batches, 15);

        // Batch 1 (oldest) should be exhausted
        const b1 = updatedBatches.find(b => b.id === 1);
        const b2 = updatedBatches.find(b => b.id === 2);

        expect(b1.stock).toBe(0);
        expect(b2.stock).toBe(5);
        expect(totalCOGS).toBe((10 * 1000) + (5 * 1200)); // 10000 + 6000 = 16000
        expect(remainingQty).toBe(0);
    });

    it('should report remainingQty if stock is insufficient', () => {
        const batches = [
            { id: 1, stock: 5, buy_price: 1000, created_at: '2024-01-01' }
        ];
        const { totalCOGS, remainingQty } = calculateFIFOReduction(batches, 10);

        expect(totalCOGS).toBe(5000);
        expect(remainingQty).toBe(5);
    });
});

describe('Stock Opname Calculations', () => {
    describe('calculateStockDifference', () => {
        it('should return correct difference', () => {
            expect(calculateStockDifference(10, 5)).toBe(5);
            expect(calculateStockDifference(5, 10)).toBe(-5);
            expect(calculateStockDifference(0, 5)).toBe(-5);
            expect(calculateStockDifference('10', 5)).toBe(5);
        });

        it('should return null for empty/invalid input', () => {
            expect(calculateStockDifference('', 5)).toBeNull();
            expect(calculateStockDifference(undefined, 5)).toBeNull();
            expect(calculateStockDifference(null, 5)).toBeNull();
        });
    });

    describe('calculateStockDifferenceValue', () => {
        it('should calculate correct monetary value', () => {
            expect(calculateStockDifferenceValue(5, 1000)).toBe(5000);
            expect(calculateStockDifferenceValue(-2, 1000)).toBe(-2000);
            expect(calculateStockDifferenceValue(0, 1000)).toBe(0);
        });

        it('should return null if difference is null', () => {
            expect(calculateStockDifferenceValue(null, 1000)).toBeNull();
        });
    });
});
