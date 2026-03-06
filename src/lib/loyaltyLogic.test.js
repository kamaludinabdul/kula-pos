import { describe, it, expect } from 'vitest';
import { calculateLoyaltyPoints, calculateStampUpdates } from './loyaltyLogic';

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
    it('should calculate points correctly for "per_product" rule', () => {
        const productRules = [
            { id: 'rule_1', rule_type: 'per_product', is_active: true, product_ids: ['p1'], points_per_item: 5 },
            { id: 'rule_2', rule_type: 'per_product', is_active: true, product_ids: ['p2'], points_per_item: 10 }
        ];
        const cartItems = [
            { id: 'p1', qty: 2 }, // 2 * 5 = 10 points
            { id: 'p2', qty: 1 }  // 1 * 10 = 10 points
        ];
        const result = calculateLoyaltyPoints({
            loyaltySettings: { isActive: true, ruleType: 'per_product' },
            transactionTotal: 100000,
            cartItems,
            loyaltyProductRules: productRules,
            selectedCustomer: mockCustomer
        });

        expect(result.pointsEarned).toBe(20);
        expect(result.customerTotalPoints).toBe(120);
    });
});

describe('calculateStampUpdates', () => {
    const mockStampRule = {
        id: 'rule_stamp_1',
        name: 'Stamp Kopi',
        rule_type: 'stamp_card',
        is_active: true,
        product_ids: ['prod_kopi'],
        stamp_target: 10,
        stamp_reward_points: 50
    };

    const mockCart = [
        { id: 'prod_kopi', name: 'Kopi Susu', qty: 1, price: 15000 }
    ];

    it('should return empty updates if no eligible products in cart', () => {
        const result = calculateStampUpdates({
            cartItems: [{ id: 'prod_non_stamp', qty: 1 }],
            loyaltyProductRules: [mockStampRule],
            customerStamps: []
        });
        expect(result.updates).toHaveLength(0);
        expect(result.bonusPoints).toBe(0);
    });

    it('should increment stamps for a new card', () => {
        const result = calculateStampUpdates({
            cartItems: mockCart,
            loyaltyProductRules: [mockStampRule],
            customerStamps: []
        });
        expect(result.updates).toHaveLength(1);
        expect(result.updates[0].current_stamps).toBe(1);
        expect(result.updates[0].reward_reached).toBe(false);
    });

    it('should increment stamps for an existing card', () => {
        const result = calculateStampUpdates({
            cartItems: mockCart,
            loyaltyProductRules: [mockStampRule],
            customerStamps: [{ rule_id: 'rule_stamp_1', current_stamps: 5, completed_count: 0 }]
        });
        expect(result.updates[0].current_stamps).toBe(6);
    });

    it('should reach reward and reset when target hit', () => {
        // Current 9, add 1 = 10 (Target hit)
        const result = calculateStampUpdates({
            cartItems: mockCart,
            loyaltyProductRules: [mockStampRule],
            customerStamps: [{ rule_id: 'rule_stamp_1', current_stamps: 9, completed_count: 0 }]
        });
        expect(result.updates[0].current_stamps).toBe(0); // Reset
        expect(result.updates[0].completed_count).toBe(1);
        expect(result.updates[0].reward_reached).toBe(true);
        expect(result.bonusPoints).toBe(50); // Reward points added
    });

    it('should handle multiple rewards correctly', () => {
        const rule2 = { ...mockStampRule, id: 'rule_2', name: 'Rule 2', product_ids: ['prod_2'], stamp_target: 5 };
        const cart = [
            { id: 'prod_kopi', qty: 1 },
            { id: 'prod_2', qty: 1 }
        ];

        const result = calculateStampUpdates({
            cartItems: cart,
            loyaltyProductRules: [mockStampRule, rule2],
            customerStamps: [
                { rule_id: 'rule_stamp_1', current_stamps: 9, completed_count: 0 },
                { rule_id: 'rule_2', current_stamps: 2, completed_count: 0 }
            ]
        });

        expect(result.updates).toHaveLength(2);
        // Rule 1 hit reward
        const up1 = result.updates.find(u => u.rule_id === 'rule_stamp_1');
        expect(up1.reward_reached).toBe(true);
        // Rule 2 just incremented
        const up2 = result.updates.find(u => u.rule_id === 'rule_2');
        expect(up2.current_stamps).toBe(3);
        expect(up2.reward_reached).toBe(false);
    });
});
