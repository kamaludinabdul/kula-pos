import { describe, it, expect, vi } from 'vitest';
import { formatPaymentMethod, calculateAge, formatAge, cn } from './utils';

describe('Utility Functions', () => {
    describe('cn (ClassName utility)', () => {
        it('should merge class names correctly', () => {
            expect(cn('p-4', 'bg-red-500')).toBe('p-4 bg-red-500');
        });

        it('should handle conditional classes', () => {
            // Test with explicit values instead of constant conditions to satisfy linter
            const isRed = true;
            const isWhite = false;
            expect(cn('p-4', isRed && 'bg-red-500', isWhite && 'text-white')).toBe('p-4 bg-red-500');
        });

        it('should handle tailwind conflicts (merge)', () => {
            expect(cn('p-4 p-2')).toBe('p-2'); // Tailwind merge should take last one
        });
    });

    describe('formatPaymentMethod', () => {
        it('should format known methods correctly', () => {
            expect(formatPaymentMethod('cash')).toBe('Tunai');
            expect(formatPaymentMethod('qris')).toBe('QRIS');
            expect(formatPaymentMethod('transfer')).toBe('Transfer');
        });

        it('should format snake_case to Title Case', () => {
            expect(formatPaymentMethod('credit_card')).toBe('Credit Card');
            expect(formatPaymentMethod('debit_card')).toBe('Debit Card');
        });

        it('should handle undefined/null', () => {
            expect(formatPaymentMethod(null)).toBe('-');
            expect(formatPaymentMethod(undefined)).toBe('-');
        });
    });

    describe('calculateAge', () => {
        it('should calculate age correctly', () => {
            // Mock date: 2024-01-01
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-01'));

            const birthDate = '2023-01-01'; // 1 year ago
            expect(calculateAge(birthDate)).toEqual({ years: 1, months: 0 });

            const birthDate2 = '2023-11-01'; // 2 months ago
            expect(calculateAge(birthDate2)).toEqual({ years: 0, months: 2 });

            vi.useRealTimers();
        });
    });

    describe('formatAge', () => {
        it('should format age string correctly', () => {
            // Mock date: 2024-01-01
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-01'));

            expect(formatAge('2023-01-01')).toBe('1 Thn');
            expect(formatAge('2023-11-01')).toBe('2 Bln');
            expect(formatAge('2023-12-15')).toBe('< 1 Bulan'); // Less than a month

            vi.useRealTimers();
        });

        it('should handle null birthdate', () => {
            expect(formatAge(null)).toBe('-');
        });
    });
});
