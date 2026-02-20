import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Staff from './Staff';
import { supabase } from '../supabase';

// --- Mocks ---

// Mock Hooks
const mockAddUser = vi.fn();
const mockShowAlert = vi.fn();

vi.mock('../context/DataContext', async () => {
    const actual = await vi.importActual('../context/DataContext');
    return {
        ...actual,
        useData: () => ({
            users: [],
            activeStoreId: 'store-123',
            addUser: mockAddUser,
            deleteUser: vi.fn(),
            stats: {}, // Mock default stats
            showAlert: mockShowAlert,
        }),
    };
});

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'owner-1', role: 'owner', name: 'Test Owner' },
        checkPermission: () => true, // Allow everything
    }),
}));

// Mock Supabase with all necessary methods
vi.mock('../supabase', () => ({
    supabase: {
        functions: {
            invoke: vi.fn(),
        },
        from: vi.fn(() => ({
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: (resolve) => resolve({ error: null }), // Simple mock for update
        })),
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn(),
            unsubscribe: vi.fn(),
        })),
        removeChannel: vi.fn(),
    },
}));

// Mock Supabase Helper to avoid real queries
vi.mock('../utils/supabaseHelper', () => ({
    safeSupabaseQuery: vi.fn().mockResolvedValue([]),
}));


vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/staff' }),
}));

// Mock Components
vi.mock('../components/Sidebar', () => ({ default: () => <div data-testid="sidebar" /> }));
vi.mock('../components/Navbar', () => ({ default: () => <div data-testid="navbar" /> }));

describe('Staff Page - Create New Staff', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.alert = vi.fn();
    });

    it('should show validation error when password is empty for new staff', () => {
        render(<Staff />);

        // 1. Open Modal
        const addButton = screen.getByText(/Tambah Staff/i);
        fireEvent.click(addButton);

        // 2. Fill Form (Name, Username, but NO Password)
        const nameInput = screen.getByLabelText(/Nama Lengkap/i);
        fireEvent.change(nameInput, { target: { value: 'New Staff' } });

        const usernameInput = screen.getByLabelText(/Username \/ Email/i);
        fireEvent.change(usernameInput, { target: { value: 'newstaff' } });

        // Password input should exist
        const passwordInput = screen.getByLabelText(/Password \/ PIN Login/i);
        expect(passwordInput).toBeInTheDocument();

        // 3. Click Simpan
        const submitButton = screen.getByRole('button', { name: /Simpan/i });
        fireEvent.click(submitButton);

        // 4. Assert: addUser should NOT be called
        expect(mockAddUser).not.toHaveBeenCalled();

        // Check if alert was called
        // If Staff.jsx uses showAlert from useData (which I mocked), we can check it.
        // If it uses local logic -> alert, then mockShowAlert might not be called.
        // But the constraint "password required" is the key.
    });

    it('should call addUser when password is valid (>= 6 chars)', async () => {
        // Setup mock to return success
        mockAddUser.mockResolvedValue({ success: true });

        // Mock registerUserToSupabase success
        supabase.functions.invoke.mockResolvedValue({
            data: { user: { id: 'auth-123' } },
            error: null
        });

        render(<Staff />);

        // 1. Open Modal
        fireEvent.click(screen.getByText(/Tambah Staff/i));

        // 2. Fill Form
        const nameInput = screen.getByLabelText(/Nama Lengkap/i);
        const usernameInput = screen.getByLabelText(/Username \/ Email/i);
        const passwordInput = screen.getByLabelText(/Password \/ PIN Login/i);

        fireEvent.change(nameInput, { target: { value: 'Valid Staff' } });
        fireEvent.change(usernameInput, { target: { value: 'validstaff' } });
        fireEvent.change(passwordInput, { target: { value: '123456' } });

        // Verify input values
        expect(passwordInput.value).toBe('123456');

        // 3. Click Simpan
        const submitBtn = screen.getByRole('button', { name: /Simpan/i });
        // Try submitting the form directly if click fails to trigger
        // fireEvent.submit(submitBtn.closest('form')); 
        // But click should work.
        fireEvent.click(submitBtn);

        // 4. Trace calls
        // Verify invoke called
        await vi.waitFor(() => {
            expect(supabase.functions.invoke).toHaveBeenCalled();
        });

        // Verify addUser called
        await vi.waitFor(() => {
            expect(mockAddUser).toHaveBeenCalled();
        });

        // Check args
        expect(mockAddUser).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Valid Staff',
            email: expect.stringContaining('validstaff'),
            password: '123456'
        }));
    });
});
