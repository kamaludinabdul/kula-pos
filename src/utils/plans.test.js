import { describe, it, expect } from 'vitest';
import { checkPlanAccess, getRequiredPlanForFeature } from './plans';

describe('checkPlanAccess', () => {
    it('should allow access to free features for free plan', () => {
        expect(checkPlanAccess('free', 'free')).toBe(true);
    });

    it('should deny access to pro features for free plan', () => {
        expect(checkPlanAccess('free', 'pro')).toBe(false);
    });

    it('should allow access to pro features for pro plan', () => {
        expect(checkPlanAccess('pro', 'pro')).toBe(true);
    });

    it('should allow access to free features for pro plan', () => {
        expect(checkPlanAccess('pro', 'free')).toBe(true);
    });

    it('should allow access to any feature for enterprise plan', () => {
        expect(checkPlanAccess('enterprise', 'free')).toBe(true);
        expect(checkPlanAccess('enterprise', 'pro')).toBe(true);
        expect(checkPlanAccess('enterprise', 'enterprise')).toBe(true);
    });

    it('should handle undefined plans gracefully (default to free)', () => {
        expect(checkPlanAccess(undefined, 'free')).toBe(true);
        expect(checkPlanAccess(undefined, 'pro')).toBe(false);
    });
});

describe('getRequiredPlanForFeature', () => {
    it('should return pro for known pro features', () => {
        expect(getRequiredPlanForFeature('reports.profit_loss')).toBe('pro');
    });

    it('should return enterprise for known enterprise features', () => {
        expect(getRequiredPlanForFeature('reports.sales_forecast')).toBe('enterprise');
    });

    it('should return free for unknown features', () => {
        expect(getRequiredPlanForFeature('unknown.feature')).toBe('free');
    });
});
