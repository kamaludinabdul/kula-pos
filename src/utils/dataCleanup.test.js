import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteStoreData } from './dataCleanup';

// Mock supabase
vi.mock('../supabase', () => ({
    supabase: {
        from: vi.fn()
    }
}));

import { supabase } from '../supabase';

describe('dataCleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('deleteStoreData', () => {
        it('should return error if storeId is not provided', async () => {
            const result = await deleteStoreData(null);
            expect(result.success).toBe(false);
            expect(result.error).toBe("Store ID is required");
        });

        it('should return error if storeId is empty string', async () => {
            const result = await deleteStoreData('');
            expect(result.success).toBe(false);
            expect(result.error).toBe("Store ID is required");
        });

        it('should delete data from all specified tables', async () => {
            const mockDelete = vi.fn().mockReturnThis();
            const mockEq = vi.fn().mockResolvedValue({ count: 5, error: null });

            supabase.from.mockReturnValue({
                delete: mockDelete.mockReturnValue({
                    eq: mockEq
                })
            });

            const result = await deleteStoreData('store-123');

            expect(result.success).toBe(true);
            expect(result.counts).toBeDefined();

            // Verify all expected tables were targeted
            const expectedTables = [
                'products', 'transactions', 'stock_movements', 'batches',
                'categories', 'purchase_orders', 'suppliers', 'sales_targets',
                'promotions', 'customers', 'cash_flow', 'shifts', 'shift_movements',
                'stock_opname_sessions', 'shopping_recommendations', 'audit_logs',
                'rental_units', 'rental_sessions'
            ];

            expectedTables.forEach(table => {
                expect(supabase.from).toHaveBeenCalledWith(table);
            });
        });

        it('should handle errors from individual table deletions', async () => {
            const mockDelete = vi.fn().mockReturnThis();
            const mockEq = vi.fn()
                .mockResolvedValueOnce({ count: 5, error: null })
                .mockResolvedValueOnce({ count: null, error: { message: 'Delete failed' } })
                .mockResolvedValue({ count: 0, error: null });

            supabase.from.mockReturnValue({
                delete: mockDelete.mockReturnValue({
                    eq: mockEq
                })
            });

            const result = await deleteStoreData('store-123');

            // Should still return success (partial success)
            expect(result.success).toBe(true);

            // One table should have error in stats
            const hasErrorStat = Object.values(result.counts).some(
                stat => typeof stat === 'string' && stat.includes('Error')
            );
            expect(hasErrorStat).toBe(true);
        });

        it('should handle unexpected exceptions', async () => {
            supabase.from.mockImplementation(() => {
                throw new Error('Network error');
            });

            const result = await deleteStoreData('store-123');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
        });
    });
});
