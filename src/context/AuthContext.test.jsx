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
            signInWithPassword: vi.fn(),
            resetPasswordForEmail: vi.fn(),
            getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
            onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
        from: vi.fn(() => {
            const builder = {
                select: vi.fn().mockReturnThis(),
                insert: vi.fn().mockResolvedValue({ error: null }),
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: {}, error: null }),
            };
            return builder;
        }),
        rpc: vi.fn().mockResolvedValue({ error: null }),
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

    it('should call supabase.auth.signUp with correct metadata and captchaToken', async () => {
        // Mock success response (auto-confirmed)
        const mockResponse = { 
            data: { user: { id: '123', email_confirmed_at: '2023-01-01' } }, 
            error: null 
        };
        supabase.auth.signUp.mockResolvedValue(mockResponse);

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        const email = 'newstore@test.com';
        const password = 'password123';
        const name = 'New Owner';
        const storeName = 'My Great Store';
        const captchaToken = 'mock-captcha-token';

        let response;
        await act(async () => {
            response = await result.current.signup(email, password, name, storeName, 'general', captchaToken);
        });

        expect(supabase.auth.signUp).toHaveBeenCalledWith({
            email,
            password,
            options: {
                data: {
                    business_type: 'general',
                    name,
                    store_name: storeName,
                    role: 'owner'
                },
                captchaToken: 'mock-captcha-token'
            }
        });

        expect(response.success).toBe(true);
        expect(response.requiresConfirmation).toBe(false);
    });

    it('should return requiresConfirmation: true when email is not confirmed', async () => {
        // Mock success response (requires confirmation)
        const mockResponse = { 
            data: { user: { id: '123', email_confirmed_at: null } }, 
            error: null 
        };
        supabase.auth.signUp.mockResolvedValue(mockResponse);

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        let response;
        await act(async () => {
            response = await result.current.signup('confirm@test.com', 'pass', 'Name', 'Store');
        });

        expect(response.success).toBe(true);
        expect(response.requiresConfirmation).toBe(true);
        expect(response.message).toContain('cek email Anda');
    });

    it('should handle signup error gracefully', async () => {
        supabase.auth.signUp.mockResolvedValue({ data: { user: null }, error: { message: 'Email already registered' } });

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        let response;
        await act(async () => {
            response = await result.current.signup('fail@test.com', 'pass', 'Name', 'Store');
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Email already registered');
    });
});

describe('AuthContext - Login', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call supabase.auth.signInWithPassword and return success', async () => {
        supabase.auth.signInWithPassword.mockResolvedValue({ 
            data: { user: { id: '123' }, session: { access_token: 'token' } }, 
            error: null 
        });

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        let response;
        await act(async () => {
            response = await result.current.login('test@kula.com', 'mypassword');
        });

        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
            email: 'test@kula.com',
            password: 'mypassword'
        });
        expect(response.success).toBe(true);
    });

    it('should handle login error', async () => {
        supabase.auth.signInWithPassword.mockResolvedValue({ 
            data: { user: null }, 
            error: { message: 'Invalid credentials' } 
        });

        const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

        let response;
        await act(async () => {
            response = await result.current.login('wrong@kula.com', 'wrong');
        });

        expect(response.success).toBe(false);
        expect(response.message).toBe('Invalid credentials');
    });
});
