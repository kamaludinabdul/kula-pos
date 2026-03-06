import { describe, it, expect } from 'vitest';
import { calculateShiftClosure } from './shiftLogic';

describe('calculateShiftClosure', () => {
    it('should calculate zero difference when actual matches expected', () => {
        const result = calculateShiftClosure({
            initialCash: 100000,
            totalCashSales: 500000,
            totalCashIn: 50000,
            totalCashOut: 20000,
            finalCash: 630000, // 100 + 500 + 50 - 20
            totalNonCashSales: 200000,
            finalNonCash: 200000
        });

        expect(result.expectedCash).toBe(630000);
        expect(result.cashDifference).toBe(0);
        expect(result.nonCashDifference).toBe(0);
    });

    it('should calculate negative difference (shortage)', () => {
        const result = calculateShiftClosure({
            initialCash: 100000,
            totalCashSales: 500000,
            finalCash: 580000, // Expected 600000
        });

        expect(result.cashDifference).toBe(-20000);
    });

    it('should calculate positive difference (overage)', () => {
        const result = calculateShiftClosure({
            initialCash: 100000,
            totalCashSales: 500000,
            finalCash: 615000, // Expected 600000
        });

        expect(result.cashDifference).toBe(15000);
    });

    it('should handle non-cash differences', () => {
        const result = calculateShiftClosure({
            totalNonCashSales: 250000,
            finalNonCash: 245000,
        });

        expect(result.nonCashDifference).toBe(-5000);
    });
});
