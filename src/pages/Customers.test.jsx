import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Customers from './Customers';


vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'owner' },
        checkPermission: () => true,
    })
}));

vi.mock('../context/DataContext', () => ({
    useData: () => ({
        customers: [
            { id: 'cust-1', name: 'Budi Santoso', phone: '08111111111', email: 'budi@test.com', address: 'Jakarta', loyaltyPoints: 100, totalSpent: 500000 },
            { id: 'cust-2', name: 'Ani Wijaya', phone: '08222222222', email: 'ani@test.com', address: 'Bandung', loyaltyPoints: 50, totalSpent: 250000 },
        ],
        transactions: [],
        addCustomer: vi.fn().mockResolvedValue({ id: 'new-cust', name: 'Test' }),
        updateCustomer: vi.fn().mockResolvedValue(true),
        deleteCustomer: vi.fn().mockResolvedValue(true),
    })
}));

vi.mock('../hooks/useBusinessType', () => ({
    useBusinessType: () => ({ term: (k) => k, type: 'general' })
}));

vi.mock('lucide-react', () => ({
    Plus: () => <span />, Search: () => <span />, Edit: () => <span />, Trash2: () => <span />,
    User: () => <span />, Mail: () => <span />, Phone: () => <span />, MapPin: () => <span />,
    Edit2: () => <span />, History: () => <span />, ArrowUp: () => <span />,
    ArrowDown: () => <span />, ArrowUpDown: () => <span />,
}));

vi.mock('../components/ui/dialog', () => ({
    Dialog: ({ children }) => <div>{children}</div>,
    DialogContent: ({ children }) => <div>{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <div>{children}</div>,
    DialogFooter: ({ children }) => <div>{children}</div>,
    DialogTrigger: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/ui/card', () => ({
    Card: ({ children, className }) => <div className={className}>{children}</div>,
    CardContent: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/Pagination', () => ({
    default: () => <div data-testid="pagination" />,
}));

vi.mock('../components/ConfirmDialog', () => ({
    default: () => <div data-testid="confirm-dialog" />,
}));

vi.mock('../components/AlertDialog', () => ({
    default: () => <div data-testid="alert-dialog" />,
}));

vi.mock('../components/CustomerTransactionHistory', () => ({
    default: () => <div data-testid="customer-history" />,
}));

vi.mock('../components/CustomerFormDialog', () => ({
    default: ({ open, onOpenChange }) => (
        open ? <div data-testid="customer-form-dialog"><button onClick={() => onOpenChange(false)}>Close</button></div> : null
    ),
}));

describe('Customers Page', () => {
    const renderComponent = () =>
        render(<BrowserRouter><Customers /></BrowserRouter>);

    it('renders an h1 heading', () => {
        renderComponent();
        // heading text is term('customer') → 'customer' from mock
        const headings = document.querySelectorAll('h1');
        expect(headings.length).toBeGreaterThan(0);
    });

    it('renders customer names from mock data in the table', () => {
        renderComponent();
        expect(screen.queryAllByText('Budi Santoso').length).toBeGreaterThan(0);
        expect(screen.queryAllByText('Ani Wijaya').length).toBeGreaterThan(0);
    });

    it('renders search input', () => {
        renderComponent();
        const input = screen.getByPlaceholderText(/cari/i);
        expect(input).toBeInTheDocument();
    });

    it('filters customers by name — only Budi remains after searching "Budi"', () => {
        renderComponent();
        const input = screen.getByPlaceholderText(/cari/i);
        fireEvent.change(input, { target: { value: 'Budi' } });
        expect(screen.queryAllByText('Budi Santoso').length).toBeGreaterThan(0);
        expect(screen.queryByText('Ani Wijaya')).not.toBeInTheDocument();
    });

    it('filters customers by phone number — only Ani remains after searching her phone', () => {
        renderComponent();
        const input = screen.getByPlaceholderText(/cari/i);
        fireEvent.change(input, { target: { value: '08222222222' } });
        expect(screen.queryAllByText('Ani Wijaya').length).toBeGreaterThan(0);
        expect(screen.queryByText('Budi Santoso')).not.toBeInTheDocument();
    });

    it('renders pagination', () => {
        renderComponent();
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    it('shows "Tambah" button', () => {
        renderComponent();
        expect(screen.getByText(/Tambah/i)).toBeInTheDocument();
    });
});
