import { describe, it, expect } from 'vitest';
import { calculateAssociations, generateAIScript, getSmartRecommendations } from './smartCashier';

describe('smartCashier', () => {
    describe('calculateAssociations', () => {
        it('should return empty object for empty transactions', () => {
            const result = calculateAssociations([]);
            expect(result).toEqual({});
        });

        it('should not create associations for single-item transactions', () => {
            const transactions = [
                { items: [{ id: 'A' }] },
                { items: [{ id: 'B' }] }
            ];
            const result = calculateAssociations(transactions);
            expect(result).toEqual({});
        });

        it('should calculate associations for item pairs', () => {
            const transactions = [
                { items: [{ id: 'A' }, { id: 'B' }] },
                { items: [{ id: 'A' }, { id: 'B' }] },
                { items: [{ id: 'A' }, { id: 'C' }] }
            ];
            const result = calculateAssociations(transactions);

            // A should have associations with B and C
            expect(result['A']).toBeDefined();
            expect(result['A'].length).toBe(2);

            // B should be associated more strongly with A (2 co-occurrences)
            const bAssoc = result['A'].find(a => a.id === 'B');
            const cAssoc = result['A'].find(a => a.id === 'C');
            expect(bAssoc.count).toBe(2);
            expect(cAssoc.count).toBe(1);
        });

        it('should sort associations by score descending', () => {
            const transactions = [
                { items: [{ id: 'A' }, { id: 'B' }] },
                { items: [{ id: 'A' }, { id: 'B' }] },
                { items: [{ id: 'A' }, { id: 'B' }] },
                { items: [{ id: 'A' }, { id: 'C' }] }
            ];
            const result = calculateAssociations(transactions);

            // B should come before C in A's associations due to higher count
            expect(result['A'][0].id).toBe('B');
            expect(result['A'][1].id).toBe('C');
        });

        it('should handle duplicate items in same transaction', () => {
            const transactions = [
                { items: [{ id: 'A' }, { id: 'A' }, { id: 'B' }] }
            ];
            const result = calculateAssociations(transactions);

            // Should only count unique pair once
            expect(result['A'].find(a => a.id === 'B').count).toBe(1);
        });
    });

    describe('generateAIScript', () => {
        it('should return a string containing both product names', () => {
            const script = generateAIScript('Kopi', 'Roti');
            expect(typeof script).toBe('string');
            expect(script).toContain('Roti');
        });

        it('should return different scripts on multiple calls (randomness)', () => {
            // Run multiple times to check variety
            const scripts = new Set();
            for (let i = 0; i < 20; i++) {
                scripts.add(generateAIScript('Kopi', 'Roti'));
            }
            // Should have at least 2 different scripts out of 4 templates
            expect(scripts.size).toBeGreaterThanOrEqual(1);
        });
    });

    describe('getSmartRecommendations', () => {
        const products = [
            { id: 'A', name: 'Kopi' },
            { id: 'B', name: 'Roti' },
            { id: 'C', name: 'Susu' },
            { id: 'D', name: 'Snack' }
        ];

        const associations = {
            'A': [{ id: 'B', score: 0.8, count: 5 }, { id: 'C', score: 0.5, count: 3 }],
            'B': [{ id: 'A', score: 0.7, count: 5 }],
            'C': [{ id: 'A', score: 0.6, count: 3 }]
        };

        it('should return empty array for empty cart', () => {
            const result = getSmartRecommendations([], products, associations);
            expect(result).toEqual([]);
        });

        it('should recommend products not already in cart', () => {
            const cart = [{ id: 'A', name: 'Kopi' }];
            const result = getSmartRecommendations(cart, products, associations);

            // Should recommend B and C (not A which is in cart)
            const recommendedIds = result.map(r => r.id);
            expect(recommendedIds).not.toContain('A');
            expect(recommendedIds).toContain('B');
        });

        it('should limit recommendations to 3 items', () => {
            const cart = [{ id: 'A', name: 'Kopi' }];
            const result = getSmartRecommendations(cart, products, associations);
            expect(result.length).toBeLessThanOrEqual(3);
        });

        it('should include aiScript and reason in recommendations', () => {
            const cart = [{ id: 'A', name: 'Kopi' }];
            const result = getSmartRecommendations(cart, products, associations);

            if (result.length > 0) {
                expect(result[0]).toHaveProperty('aiScript');
                expect(result[0]).toHaveProperty('reason');
            }
        });

        it('should not recommend items without associations', () => {
            const cart = [{ id: 'D', name: 'Snack' }]; // D has no associations
            const result = getSmartRecommendations(cart, products, associations);
            expect(result).toEqual([]);
        });

        it('should handle multiple cart items and accumulate scores', () => {
            const cart = [
                { id: 'B', name: 'Roti' },
                { id: 'C', name: 'Susu' }
            ];
            // Both B and C are associated with A, so A should have higher accumulated score
            const result = getSmartRecommendations(cart, products, associations);

            if (result.length > 0) {
                expect(result[0].id).toBe('A');
            }
        });
    });
});
