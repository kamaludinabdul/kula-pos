import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StaffForm from './StaffForm';
import { supabase } from '../supabase';

// --- Mocks ---

// Mock Hooks
const mockAddUser = vi.fn();
const mockToast = vi.fn();

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
        }),
    };
});

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'owner-1', role: 'owner', name: 'Test Owner' },
        checkPermission: () => true, // Allow everything
        updateStaffPassword: vi.fn().mockResolvedValue({ success: true }),
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
    useLocation: () => ({ pathname: '/staff/add' }),
    useParams: () => ({ id: undefined }), // Mock for "Add" mode
}));

// Mock Toast
vi.mock('../components/ui/use-toast', () => ({
    useToast: () => ({
        toast: mockToast
    })
}));

describe('StaffForm - Create New Staff', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.alert = vi.fn();
    });

    it('should show validation error when password is empty for new staff', async () => {
        render(<StaffForm />);

        // No need to click "Tambah Staff", we are already on the form page in the test

        // 1. Fill Form (Name, Username, but NO Password)
        const nameInput = screen.getByLabelText(/Nama Lengkap/i);
        fireEvent.change(nameInput, { target: { value: 'New Staff' } });

        const usernameInput = screen.getByLabelText(/Username \/ Email/i);
        fireEvent.change(usernameInput, { target: { value: 'newstaff' } });

        // Password input should exist
        const passwordInput = screen.getByLabelText(/Password \/ PIN/i);
        expect(passwordInput).toBeInTheDocument();

        // 2. Click Simpan
        const form = screen.getByRole('button', { name: /Simpan Data Staff/i }).closest('form');
        fireEvent.submit(form);

        // 3. Assert: addUser should NOT be called
        expect(mockAddUser).not.toHaveBeenCalled();

        // Check if toast was called with validation error
        await vi.waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
                title: "Validasi Gagal",
                description: "Password minimal 6 karakter."
            }));
        });
    });

    it('should call addUser when password is valid (>= 6 chars)', async () => {
        // Setup mock to return success
        mockAddUser.mockResolvedValue({ success: true });

        // Mock registerUserToSupabase success
        supabase.functions.invoke.mockResolvedValue({
            data: { user: { id: 'auth-123' } },
            error: null
        });

        render(<StaffForm />);

        // 1. Fill Form
        const nameInput = screen.getByLabelText(/Nama Lengkap/i);
        const usernameInput = screen.getByLabelText(/Username \/ Email/i);
        const passwordInput = screen.getByLabelText(/Password \/ PIN/i);

        fireEvent.change(nameInput, { target: { value: 'Valid Staff' } });
        fireEvent.change(usernameInput, { target: { value: 'validstaff' } });
        fireEvent.change(passwordInput, { target: { value: '123456' } });

        // Verify input values
        expect(passwordInput.value).toBe('123456');

        // 2. Click Simpan
        const form = screen.getByRole('button', { name: /Simpan Data Staff/i }).closest('form');
        fireEvent.submit(form);

        // 3. Trace calls
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
