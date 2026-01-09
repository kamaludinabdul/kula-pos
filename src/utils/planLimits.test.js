import { describe, it, expect } from 'vitest';
import { checkPlanLimit, PLAN_LIMITS } from './planLimits';

describe('checkPlanLimit with Dynamic Plans', () => {
    const dynamicPlans = {
        free: {
            maxUsers: 5, // Custom limit (default is 2)
            maxProducts: 200, // Custom limit (default is 100)
            features: ['pos', 'reports.basic']
        },
        pro: {
            maxUsers: 10,
            maxProducts: Infinity,
            features: ['pos', 'reports.advanced']
        }
    };

    it('should use dynamic limits when provided', () => {
        // Test Users Limit (Dynamic: 5)
        expect(checkPlanLimit('free', 'users', 4, dynamicPlans).allowed).toBe(true);
        expect(checkPlanLimit('free', 'users', 5, dynamicPlans).allowed).toBe(false);

        // Test Products Limit (Dynamic: 200)
        expect(checkPlanLimit('free', 'products', 199, dynamicPlans).allowed).toBe(true);
        expect(checkPlanLimit('free', 'products', 200, dynamicPlans).allowed).toBe(false);
    });

    it('should fallback to hardcoded limits when dynamic plan is missing', () => {
        const partialDynamic = {
            pro: dynamicPlans.pro
        };
        // Free plan is missing in partialDynamic, should use hardcoded defaults (Users: 2)
        expect(checkPlanLimit('free', 'users', 1, partialDynamic).allowed).toBe(true);
        expect(checkPlanLimit('free', 'users', 2, partialDynamic).allowed).toBe(false);
    });

    it('should handle missing dynamicPlans argument gracefully', () => {
        // Should use hardcoded defaults (Free Users: 2)
        expect(checkPlanLimit('free', 'users', 1).allowed).toBe(true);
        expect(checkPlanLimit('free', 'users', 2).allowed).toBe(false);
    });

    it('should handle unlimited limits correctly', () => {
        // Pro Users: 10
        expect(checkPlanLimit('pro', 'users', 9, dynamicPlans).allowed).toBe(true);
        expect(checkPlanLimit('pro', 'users', 10, dynamicPlans).allowed).toBe(false);

        // Pro Products: Infinity
        expect(checkPlanLimit('pro', 'products', 100000, dynamicPlans).allowed).toBe(true);
    });

    it('should handle case insensitivity', () => {
        expect(checkPlanLimit('FREE', 'users', 4, dynamicPlans).allowed).toBe(true);
    });
});
