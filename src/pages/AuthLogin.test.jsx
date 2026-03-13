import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

describe('Login Page', () => {
    const mockLogin = vi.fn();
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({ login: mockLogin, user: null, loading: false });
    });

    it('renders login form correctly', () => {
        render(<MemoryRouter><Login /></MemoryRouter>);
        expect(screen.getByPlaceholderText('Username atau Email')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Masukkan password')).toBeInTheDocument();
    });

    it('calls login on submit', async () => {
        mockLogin.mockResolvedValue({ success: true });
        render(<MemoryRouter><Login /></MemoryRouter>);
        
        fireEvent.change(screen.getByPlaceholderText('Username atau Email'), { target: { value: 'test@kula.com' } });
        fireEvent.change(screen.getByPlaceholderText('Masukkan password'), { target: { value: 'pass123' } });
        
        const loginBtn = screen.getByRole('button', { name: /Masuk/i });
        fireEvent.click(loginBtn);
        
        await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('test@kula.com', 'pass123'));
    });
});
