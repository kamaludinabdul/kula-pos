import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { DataProvider, useData } from './DataContext';
import { supabase } from '../supabase';

// 1. Mock Auth
const mockUser = { id: 'owner-123', email: 'owner@test.com', role: 'owner' };
vi.mock('./AuthContext', () => ({
    useAuth: vi.fn(() => ({
        user: mockUser,
        loading: false
    }))
}));

// 2. Helper for Thenable Mock (for chaining .select().eq()...)
const createMockQueryBuilder = (data) => {
    const thenable = {
        then: (resolve) => resolve({ data, error: null }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
    };
    thenable.select.mockReturnValue(thenable);
    thenable.eq.mockReturnValue(thenable);
    thenable.order.mockReturnValue(thenable);
    thenable.upsert.mockReturnValue(thenable);
    thenable.single.mockReturnValue(thenable);
    thenable.insert.mockReturnValue(thenable);
    return thenable;
};

// 3. Mock Supabase
// 3. Mock Supabase Helper (Bypass fallback logic)
vi.mock('../utils/supabaseHelper', () => ({
    safeSupabaseQuery: vi.fn(({ tableName }) => {
        if (tableName === 'products') {
            return Promise.resolve([
                { id: 'prod-1', name: 'Kopi', price: 10000, stock: 10, buy_price: 5000 },
                { id: 'prod-2', name: 'Teh', price: 5000, stock: 20, buy_price: 2000 }
            ]);
        }
        if (tableName === 'customers') {
            return Promise.resolve([
                { id: 'cust-1', name: 'Pelanggan Setia', debt: 0, total_spent: 0, loyalty_points: 0 }
            ]);
        }
        return Promise.resolve([]);
    }),
    safeSupabaseRpc: vi.fn(({ rpcName }) => {
        if (rpcName === 'get_store_initial_snapshot') {
            return Promise.resolve({ categories: [], summary: {} });
        }
        return Promise.resolve(null);
    }),
    safeFetchSupabase: vi.fn(({ tableName }) => { // Used in Phase 3
        if (tableName === 'customers') {
            return Promise.resolve([
                { id: 'cust-1', name: 'Pelanggan Setia', debt: 0, total_spent: 0, loyalty_points: 0 }
            ]);
        }
        return Promise.resolve([]);
    })
}));

// 4. Mock Supabase Client (For direct calls like processSale)
vi.mock('../supabase', () => ({
    supabase: {
        from: vi.fn(), // Still needed for other calls if any
        rpc: vi.fn(),
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
    },
}));

// Wrapper
const wrapper = ({ children }) => (
    <DataProvider>{children}</DataProvider>
);

describe('Transaction Integration (processSale)', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default Mock Setup for DataContext Initialization
        // Stores
        supabase.from.mockImplementation((table) => {
            if (table === 'stores') {
                return createMockQueryBuilder([{ id: 'store-1', name: 'My Store', owner_id: 'owner-123' }]);
            }
            if (table === 'products') {
                return createMockQueryBuilder([
                    { id: 'prod-1', name: 'Kopi', price: 10000, stock: 10, buy_price: 5000 },
                    { id: 'prod-2', name: 'Teh', price: 5000, stock: 20, buy_price: 2000 }
                ]);
            }
            if (table === 'customers') {
                return createMockQueryBuilder([
                    { id: 'cust-1', name: 'Pelanggan Setia', debt: 0, total_spent: 0, loyalty_points: 0 }
                ]);
            }
            return createMockQueryBuilder([]);
        });
    });

    it('should process a CASH sale successfully and update stock optimistically', async () => {
        vi.useFakeTimers();

        // Mock RPC Success
        supabase.rpc.mockResolvedValue({
            data: { success: true, transaction_id: 'trans-101' },
            error: null
        });

        const { result } = renderHook(() => useData(), { wrapper });

        // Wait for init and select store
        await act(async () => {
            vi.advanceTimersByTime(100);
            result.current.setSelectedStoreId('store-1');
        });

        // Fast-forward 3s loading delay in DataContext
        await act(async () => {
            vi.advanceTimersByTime(4000);
        });

        // Manual Product Fetch for Test
        await act(async () => {
            await result.current.fetchAllProducts();
        });

        const transactionData = {
            items: [{ id: 'prod-1', name: 'Kopi', qty: 2, price: 10000, buyPrice: 5000 }],
            total: 20000,
            paymentMethod: 'cash',
            date: new Date().toISOString()
        };

        let response;
        await act(async () => {
            response = await result.current.processSale(transactionData);
        });

        // 1. Check Response
        expect(response.success).toBe(true);
        expect(response.transaction.id).toBe('trans-101');

        // 2. Check RPC Call
        expect(supabase.rpc).toHaveBeenCalledWith('process_sale', expect.objectContaining({
            p_store_id: 'store-1',
            p_total: 20000,
            p_items: expect.arrayContaining([
                expect.objectContaining({ id: 'prod-1', qty: 2 })
            ])
        }));

        // 3. Check Optimistic Update (Stock Reduction)
        const updatedProduct = result.current.products.find(p => p.id === 'prod-1');
        // Initial stock 10 - sold 2 = 8
        expect(updatedProduct.stock).toBe(8);

        // 4. Check Transaction Log
        const log = result.current.transactions.find(t => t.id === 'trans-101');
        expect(log).toBeDefined();
        expect(log.total).toBe(20000);
        expect(log.total).toBe(20000);

        vi.useRealTimers();
    });

    it('should update customer DEBT when payment method is debt', { timeout: 10000 }, async () => {
        // Use Real Timers for this test to ensure Phase 3 (background fetch) logic completes naturally

        supabase.rpc.mockResolvedValue({
            data: { success: true, transaction_id: 'trans-102' },
            error: null
        });

        const { result } = renderHook(() => useData(), { wrapper });

        await act(async () => {
            await new Promise(r => setTimeout(r, 100));
            result.current.setSelectedStoreId('store-1');
        });

        // Wait for DataContext 3s delay + fetch time
        await act(async () => {
            await new Promise(r => setTimeout(r, 3500));
        });

        // Wait for customers to populate
        await waitFor(() => {
            expect(result.current.customers.length).toBeGreaterThan(0);
        });

        const transactionData = {
            items: [{ id: 'prod-2', name: 'Teh', qty: 5, price: 5000 }],
            total: 25000,
            paymentMethod: 'debt',
            customerId: 'cust-1'
        };

        await act(async () => {
            await result.current.processSale(transactionData);
        });

        // Check Customer Update
        const customer = result.current.customers.find(c => c.id === 'cust-1');
        expect(customer.debt).toBe(25000); // 0 + 25000
        expect(customer.total_spent).toBe(25000);
    });

    it('should NOT update state if transaction fails (Rollback Safety)', async () => {
        vi.useFakeTimers();

        // Mock RPC Failure
        supabase.rpc.mockResolvedValue({
            data: { success: false, error: 'Database connection failed' },
            error: null
        });

        const { result } = renderHook(() => useData(), { wrapper });

        await act(async () => {
            vi.advanceTimersByTime(100);
            result.current.setSelectedStoreId('store-1');
        });

        // Fast forward 3s
        await act(async () => { await vi.advanceTimersByTime(4000); });

        // Manual Fetch
        await act(async () => { await result.current.fetchAllProducts(); });

        const transactionData = {
            items: [{ id: 'prod-1', name: 'Kopi', qty: 5, price: 10000 }],
            total: 50000,
            paymentMethod: 'cash'
        };

        let response;
        await act(async () => {
            response = await result.current.processSale(transactionData);
        });

        expect(response.success).toBe(false);
        expect(response.error).toContain('Database connection failed');

        // Check Stock NOT Reduced
        const product = result.current.products.find(p => p.id === 'prod-1');
        expect(product.stock).toBe(10); // Still 10, not 5

        vi.useRealTimers();
    });
});
