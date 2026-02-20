import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
// We need to import the Context to use the hook, but standard pattern is exporting hook.
// Let's assume `useAuth` is exported from AuthContext.
import { useAuth } from './AuthContext';
import { supabase } from '../supabase';

// Mock Supabase
vi.mock('../supabase', () => ({
    supabase: {
        auth: {
            signUp: vi.fn(),
            getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
            onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
    },
}));

// Mock utils that AuthContext uses
vi.mock('../utils/permissions', () => ({
    normalizePermissions: vi.fn().mockReturnValue([]),
    getPermissionsForRole: vi.fn(),
}));
vi.mock('../utils/supabaseHelper', () => ({
    safeSupabaseQuery: vi.fn(),
}));

describe('AuthContext - Create New Toko (Signup)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call supabase.auth.signUp with correct metadata for New Store', async () => {
        // Mock success response
        const mockResponse = { data: { user: { id: '123' } }, error: null };
        supabase.auth.signUp.mockResolvedValue(mockResponse);

        // Render Hook
        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        // Execute Signup
        const email = 'newstore@test.com';
        const password = 'password123';
        const name = 'New Owner';
        const storeName = 'My Great Store';

        let response;
        await act(async () => {
            response = await result.current.signup(email, password, name, storeName);
        });

        // Assert Call
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
            email,
            password,
            options: {
                data: {
                    name,
                    store_name: storeName,
                    role: 'owner'
                }
            }
        });

        // Assert Success Return
        expect(response.success).toBe(true);
    });

    it('should handle signup error gracefully', async () => {
        // Mock error response
        const mockError = { message: 'Email already registered' };
        supabase.auth.signUp.mockResolvedValue({ data: null, error: mockError });

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        let response;
        await act(async () => {
            response = await result.current.signup('fail@test.com', 'pass', 'Name', 'Store');
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Email already registered');
    });
});
