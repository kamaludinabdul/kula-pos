import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import ShiftReport from './ShiftReport';

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', name: 'Owner', role: 'owner' },
        checkPermission: () => true,
    })
}));

vi.mock('../../context/DataContext', () => ({
    useData: () => ({
        currentStore: { id: 'store-1', name: 'Test Store' },
    })
}));

vi.mock('../../context/ShiftContext', () => ({
    useShift: () => ({
        terminateShift: vi.fn().mockResolvedValue({ success: true }),
    })
}));

// Supabase returns one active shift (with null final_cash) + one closed shift
const mockShifts = [
    {
        id: 'shift-active-1', store_id: 'store-1', cashier_name: 'Kasir Aktif',
        status: 'active', start_time: new Date().toISOString(), end_time: null,
        initial_cash: 500000, total_sales: 0,
        final_cash: null,       // BUG GUARD
        cash_difference: null,  // BUG GUARD
        total_cash_sales: 0, total_non_cash_sales: 0, total_discount: 0,
        total_cash_in: 0, total_cash_out: 0,
    },
    {
        id: 'shift-closed-1', store_id: 'store-1', cashier_name: 'Kasir Selesai',
        status: 'closed', start_time: new Date(Date.now() - 3600000).toISOString(),
        end_time: new Date().toISOString(), initial_cash: 500000, total_sales: 1500000,
        final_cash: 1800000, cash_difference: 300000, total_cash_sales: 1200000,
        total_non_cash_sales: 300000, total_discount: 50000, total_cash_in: 0, total_cash_out: 0,
    }
];

vi.mock('../../supabase', () => {
    const mockIn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockShiftsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn(() => Promise.resolve({ data: mockShifts, error: null })),
        in: mockIn,
    };
    const mockGenericQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        in: mockIn,
    };
    return {
        supabase: {
            from: vi.fn((table) => table === 'shifts' ? mockShiftsQuery : mockGenericQuery),
        }
    };
});

vi.mock('lucide-react', () => ({
    Calendar: () => <span />, Clock: () => <span />, User: () => <span />,
    FileText: () => <span />, Download: () => <span />, RefreshCw: () => <span />,
    Ban: () => <span />,
}));

vi.mock('../../components/ui/dialog', () => ({
    Dialog: ({ children }) => <div>{children}</div>,
    DialogContent: ({ children }) => <div>{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <div>{children}</div>,
    DialogDescription: ({ children }) => <div>{children}</div>,
    DialogFooter: ({ children }) => <div>{children}</div>,
    DialogTrigger: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../components/ui/select', () => ({
    Select: ({ children }) => <div>{children}</div>,
    SelectTrigger: ({ children }) => <>{children}</>,
    SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
    SelectContent: ({ children }) => <>{children}</>,
    SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
}));

vi.mock('../../components/ui/card', () => ({
    Card: ({ children, className }) => <div className={className}>{children}</div>,
    CardContent: ({ children, className }) => <div className={className}>{children}</div>,
    CardHeader: ({ children }) => <div>{children}</div>,
    CardTitle: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../components/ui/badge', () => ({
    Badge: ({ children, className }) => <span className={className}>{children}</span>,
}));

vi.mock('../../components/SmartDatePicker', () => ({
    SmartDatePicker: ({ onDateChange }) => (
        <div data-testid="smart-date-picker">
            <button onClick={() => onDateChange({ from: new Date(), to: new Date() })}>Change</button>
        </div>
    )
}));

vi.mock('./ShiftDetailsDialog', () => ({
    default: () => <div data-testid="shift-details-dialog" />,
}));

// Fix: export all needed utils including `cn`
vi.mock('../../lib/utils', () => ({
    exportToCSV: vi.fn(),
    cn: (...args) => args.filter(Boolean).join(' '),
}));

describe('ShiftReport', () => {
    it('renders page heading', async () => {
        render(<BrowserRouter><ShiftReport /></BrowserRouter>);
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Laporan Shift/i })).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('[BUG GUARD] does NOT crash when active shift has null final_cash and null cash_difference', async () => {
        // If this test fails, the toLocaleString-on-null bug has been reintroduced
        let caughtError;
        try {
            render(<BrowserRouter><ShiftReport /></BrowserRouter>);
            await waitFor(() => {
                expect(screen.getByText(/Laporan Shift/i)).toBeInTheDocument();
            }, { timeout: 3000 });
        } catch (e) {
            caughtError = e;
        }
        expect(caughtError).toBeUndefined();
    });

    it('renders date picker', async () => {
        render(<BrowserRouter><ShiftReport /></BrowserRouter>);
        await waitFor(() => {
            expect(screen.getByTestId('smart-date-picker')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('renders Refresh and Export buttons', async () => {
        render(<BrowserRouter><ShiftReport /></BrowserRouter>);
        await waitFor(() => {
            expect(screen.getByText(/Refresh/i)).toBeInTheDocument();
            expect(screen.getByText(/Export/i)).toBeInTheDocument();
        }, { timeout: 3000 });
    });
});
