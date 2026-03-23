import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

// Mock Supabase
vi.mock('../supabase', () => ({
    supabase: {
        rpc: vi.fn(),
    },
}));

// Mock TurnstileWidget to bypass CAPTCHA requirement
vi.mock('../components/TurnstileWidget', () => ({
    __esModule: true,
    default: React.forwardRef(function MockTurnstile({ onVerify }) {
        // Automatically trigger verification in tests if needed, 
        // or just render a dummy div.
        React.useEffect(() => {
            onVerify('mock-token');
        }, [onVerify]);
        return <div data-testid="mock-turnstile" />;
    })
}));

describe('Register Page', () => {
    const mockSignup = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({
            signup: mockSignup,
            user: null,
            loading: false,
        });
    });

    it('renders and enables submit button when criteria met', async () => {
        render(<MemoryRouter><Register /></MemoryRouter>);
        
        // Fill form
        fireEvent.change(screen.getByLabelText(/Nama Toko/i), { target: { value: 'Test Store' } });
        fireEvent.change(screen.getByLabelText(/Nama Pemilik/i), { target: { value: 'Tester' } });
        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'test@kula.com' } });
        
        // Password meeting all criteria
        fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'Strong123!' } });
        fireEvent.change(screen.getByLabelText(/Konfirmasi/i), { target: { value: 'Strong123!' } });

        const submitBtn = screen.getByRole('button', { name: /Daftar Sekarang/i });
        
        // Wait for CAPTCHA mock and password validation
        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        mockSignup.mockResolvedValue({ success: true, requiresConfirmation: true });
        supabase.rpc.mockResolvedValue({ data: { status: 'available' }, error: null });
        
        fireEvent.click(submitBtn);
        
        await waitFor(() => expect(mockSignup).toHaveBeenCalled());
        expect(screen.getByText(/Cek Email Anda!/i)).toBeInTheDocument();
    });

    it('registers successfully with Pet Shop business type', async () => {
        render(<MemoryRouter><Register /></MemoryRouter>);
        
        // Fill form
        fireEvent.change(screen.getByLabelText(/Nama Toko/i), { target: { value: 'Test Pet Clinic' } });
        fireEvent.change(screen.getByLabelText(/Nama Pemilik/i), { target: { value: 'Dr. Pet' } });
        fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'pet@kula.com' } });
        
        // Select business type: "Pet Shop" is the label, finding its button container
        const petShopBtn = screen.getByText('Pet Shop').closest('button');
        fireEvent.click(petShopBtn);

        // Password meeting all criteria
        fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'Strong123!' } });
        fireEvent.change(screen.getByLabelText(/Konfirmasi/i), { target: { value: 'Strong123!' } });

        const submitBtn = screen.getByRole('button', { name: /Daftar Sekarang/i });
        
        // Wait for CAPTCHA mock and password validation
        await waitFor(() => {
            expect(submitBtn).not.toBeDisabled();
        });

        mockSignup.mockResolvedValue({ success: true, requiresConfirmation: true });
        supabase.rpc.mockResolvedValue({ data: { status: 'available' }, error: null });
        
        fireEvent.click(submitBtn);
        
        await waitFor(() => {
            // Check that signup was called with the correct arguments
            // Note: captchaToken might be null if the site key is not set in the test env
            expect(mockSignup).toHaveBeenCalled();
            
            // We can also verify the business type specifically
            const args = mockSignup.mock.calls[0];
            expect(args[4]).toBe('pet_clinic'); // The 5th argument is businessType
        });
        
        expect(screen.getByText(/Cek Email Anda!/i)).toBeInTheDocument();
    });
});

