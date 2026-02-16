import { describe, it, expect } from 'vitest';
import { calculateLoyaltyPoints } from './loyaltyLogic';

describe('calculateLoyaltyPoints', () => {
    const mockCustomer = {
        id: 'cust_123',
        name: 'Budi',
        loyaltyPoints: 100
    };

    const mockLoyaltySettingsMin = {
        isActive: true,
        ruleType: 'minimum',
        minTransactionAmount: 50000,
        pointsReward: 10
    };

    const mockLoyaltySettingsMultiple = {
        isActive: true,
        ruleType: 'multiple',
        ratioAmount: 10000,
        ratioPoints: 1
    };

    it('should return 0 points if no customer is selected', () => {
        const result = calculateLoyaltyPoints({
            loyaltySettings: mockLoyaltySettingsMin,
            transactionTotal: 100000,
            selectedCustomer: null
        });
        expect(result.pointsEarned).toBe(0);
        expect(result.customerTotalPoints).toBe(0);
    });

    it('should return 0 points if loyalty is inactive', () => {
        const result = calculateLoyaltyPoints({
            loyaltySettings: { ...mockLoyaltySettingsMin, isActive: false },
            transactionTotal: 100000,
            selectedCustomer: mockCustomer
        });
        expect(result.pointsEarned).toBe(0);
        // Customer total should still reflect their existing points
        expect(result.customerTotalPoints).toBe(100);
    });

    it('should calculate points correctly for "minimum" rule (Success)', () => {
        const result = calculateLoyaltyPoints({
            loyaltySettings: mockLoyaltySettingsMin,
            transactionTotal: 50000, // Exact minimum
            selectedCustomer: mockCustomer
        });
        expect(result.pointsEarned).toBe(10);
        expect(result.customerTotalPoints).toBe(110);
    });

    it('should calculate points correctly for "minimum" rule (Fail - Below min)', () => {
        const result = calculateLoyaltyPoints({
            loyaltySettings: mockLoyaltySettingsMin,
            transactionTotal: 49999,
            selectedCustomer: mockCustomer
        });
        expect(result.pointsEarned).toBe(0);
        expect(result.customerTotalPoints).toBe(100);
    });

    it('should calculate points correctly for "multiple" rule (Simple)', () => {
        // 20000 total / 10000 ratio = 2 * 1 point = 2 points
        const result = calculateLoyaltyPoints({
            loyaltySettings: mockLoyaltySettingsMultiple,
            transactionTotal: 20000,
            selectedCustomer: mockCustomer
        });
        expect(result.pointsEarned).toBe(2);
        expect(result.customerTotalPoints).toBe(102);
    });

    it('should calculate points correctly for "multiple" rule (With Remainder)', () => {
        // 25000 total / 10000 ratio = 2.5 -> floor(2) * 1 point = 2 points
        const result = calculateLoyaltyPoints({
            loyaltySettings: mockLoyaltySettingsMultiple,
            transactionTotal: 25000,
            selectedCustomer: mockCustomer
        });
        expect(result.pointsEarned).toBe(2);
        expect(result.customerTotalPoints).toBe(102);
    });

    it('should handle legacy "points" field in customer object', () => {
        const legacyCustomer = { id: 'cust_old', points: 50 }; // No loyaltyPoints key
        const result = calculateLoyaltyPoints({
            loyaltySettings: mockLoyaltySettingsMin,
            transactionTotal: 60000,
            selectedCustomer: legacyCustomer
        });
        expect(result.pointsEarned).toBe(10);
        expect(result.customerTotalPoints).toBe(60);
    });

    it('should return 0 earned points if ratioAmount is 0 (Avoid division by zero)', () => {
        const brokenSettings = { ...mockLoyaltySettingsMultiple, ratioAmount: 0 };
        const result = calculateLoyaltyPoints({
            loyaltySettings: brokenSettings,
            transactionTotal: 100000,
            selectedCustomer: mockCustomer
        });
        expect(result.pointsEarned).toBe(0);
    });
});
