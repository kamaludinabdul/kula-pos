import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { DataProvider, useData } from './DataContext';
import { supabase } from '../supabase';

const mockUser = { id: 'owner-123', email: 'owner@test.com', role: 'owner' };

// Mock Auth Context Hook directly
vi.mock('./AuthContext', () => ({
    useAuth: vi.fn(() => ({
        user: mockUser,
        loading: false
    }))
}));

// Helper to create a Thenable mock that supports chaining
const createMockQueryBuilder = (data) => {
    const thenable = {
        then: (resolve) => resolve({ data, error: null }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
    };
    // Make methods return the same thenable object to support chaining
    thenable.select.mockReturnValue(thenable);
    thenable.eq.mockReturnValue(thenable);
    thenable.order.mockReturnValue(thenable);
    thenable.upsert.mockReturnValue(thenable);
    thenable.single.mockReturnValue(thenable);
    return thenable;
};

// Mock Supabase locally
vi.mock('../supabase', () => ({
    supabase: {
        from: vi.fn(() => createMockQueryBuilder([])), // Default return
        rpc: vi.fn(),
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
    },
}));

// Wrapper to provide DataContext only
const wrapper = ({ children }) => (
    <DataProvider>{children}</DataProvider>
);

describe('Staff Security Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should ADD staff successfully when no conflict', async () => {
        // 1. Mock RPC to return "available"
        supabase.rpc.mockResolvedValue({ data: { status: 'available' }, error: null });

        // 2. Mock Insert Success
        supabase.from().upsert.mockResolvedValue({ error: null });

        renderHook(() => useData(), { wrapper });

        // Wait for context to init (simulated)
        // Manually trigger addUser
        let response;
        await act(async () => {
            // Need to set store but DataContext init might take time. 
            // For this unit test, verify logic flow.
            // We can bypass store check if we mock activeStoreId or set it.
            // DataContext usually initializes activeStore from localStorage or first store.
            // Let's assume we need to cheat and "set" it or mock the state if validation requires it.

            // Actually, DataContext might be complex to init fully.
            // Alternative: Determine if we can test `addUser` logic in isolation? 
            // No, it's inside the component.

            // Let's try to set a store first if the context allows.
            // Looking at DataContext.jsx, it sets activeStoreId from stores.
        });

        // Since DataContext initialization is heavy, I'll mock the `stores` query in `supabase.from('stores')` too.
        supabase.from.mockImplementation((table) => {
            if (table === 'stores') {
                return createMockQueryBuilder([{ id: 'store-1', name: 'My Store', owner_id: 'owner-123' }]);
            }
            if (table === 'profiles') {
                return createMockQueryBuilder([]);
            }
            return createMockQueryBuilder([]);
        });

        // Re-render to pick up store
        const { result: result2 } = renderHook(() => useData(), { wrapper });

        // Check if store loaded (might be async). 
        // We can just call addUser. It checks `activeStoreId`. 
        // If we mocked the store fetch well, it should update.

        // Wait for stores to load
        await act(async () => {
            await new Promise(r => setTimeout(r, 100)); // microtask flush
            result2.current.setSelectedStoreId('store-1');
        });

        const userData = { email: 'newstaff@test.com', name: 'New Staff', role: 'staff' };

        response = await act(async () => {
            return await result2.current.addUser(userData);
        });

        expect(supabase.rpc).toHaveBeenCalledWith('check_staff_conflict', {
            p_email: 'newstaff@test.com',
            p_target_store_id: 'store-1'
        });
        expect(response.success).toBe(true);
    });

    it('should BLOCK Add Staff if conflict (Cross-Store)', async () => {
        // Mock RPC conflict
        supabase.rpc.mockResolvedValue({
            data: { status: 'conflict', current_store_name: 'Other Store' },
            error: null
        });

        // Mock Store Load (boilerplate)
        // Mock Store Load (boilerplate)
        supabase.from.mockImplementation((table) => {
            if (table === 'stores') {
                return createMockQueryBuilder([{ id: 'store-1', name: 'My Store', owner_id: 'owner-123' }]);
            }
            return createMockQueryBuilder([]);
        });

        const { result } = renderHook(() => useData(), { wrapper });
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
            result.current.setSelectedStoreId('store-1');
        });

        const response = await act(async () => {
            return await result.current.addUser({ email: 'stolen@test.com' });
        });

        expect(response.success).toBe(false);
        expect(response.error).toContain('sudah digunakan oleh toko lain');
    });

    it('should BLOCK Add Staff if Same-Store Conflict (Role Downgrade Prevention)', async () => {
        // Mock RPC Same Store
        supabase.rpc.mockResolvedValue({
            data: { status: 'same_store', current_role: 'admin', id: 'existing-id' },
            error: null
        });

        // Mock Store Load
        // Mock Store Load
        supabase.from.mockImplementation((table) => {
            if (table === 'stores') {
                return createMockQueryBuilder([{ id: 'store-1', name: 'My Store', owner_id: 'owner-123' }]);
            }
            return createMockQueryBuilder([]);
        });

        const { result } = renderHook(() => useData(), { wrapper });
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
            result.current.setSelectedStoreId('store-1');
        });

        // Try to ADD (no id)
        const response = await act(async () => {
            return await result.current.addUser({ email: 'existing@test.com', role: 'staff' });
        });

        expect(response.success).toBe(false);
        expect(response.error).toContain('sudah terdaftar di toko ini sebagai admin');
    });

    it('should ALLOW Edit Staff even if Same-Store Conflict (Update Mode)', async () => {
        // Mock RPC Same Store
        supabase.rpc.mockResolvedValue({
            data: { status: 'same_store', current_role: 'staff', id: 'existing-id' },
            error: null
        });

        // Mock Store Load
        // Mock Store Load
        supabase.from.mockImplementation((table) => {
            if (table === 'stores') {
                return createMockQueryBuilder([{ id: 'store-1', name: 'My Store', owner_id: 'owner-123' }]);
            }
            if (table === 'profiles') {
                return createMockQueryBuilder([]);
            }
            return createMockQueryBuilder([]);
        });

        const { result } = renderHook(() => useData(), { wrapper });
        await act(async () => {
            await new Promise(r => setTimeout(r, 50));
            result.current.setSelectedStoreId('store-1');
        });

        // Try to EDIT (has id)
        const response = await act(async () => {
            return await result.current.addUser({ id: 'existing-id', email: 'existing@test.com', role: 'manager' });
        });

        expect(response.success).toBe(true);
    });
});
