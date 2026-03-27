import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import ProfitLoss from './ProfitLoss';

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'owner' },
        checkPermission: () => true,
    })
}));

vi.mock('../../context/DataContext', () => ({
    useData: () => ({
        currentStore: { id: 'store-1', name: 'Test Store' },
        activeStoreId: 'store-1',
        products: [],
        fetchAllProducts: vi.fn().mockResolvedValue([]),
        voidTransaction: vi.fn(),
    })
}));

const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockGte = vi.fn().mockReturnThis();
const mockLte = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockRange = vi.fn().mockResolvedValue({ data: [], error: null });

vi.mock('../../supabase', () => ({
    supabase: {
        from: vi.fn(() => ({
            select: mockSelect,
            eq: mockEq,
            gte: mockGte,
            lte: mockLte,
            order: mockOrder,
            range: mockRange,
        })),
        rpc: vi.fn().mockResolvedValue({ data: null, error: null })
    }
}));

vi.mock('../../utils/supabaseHelper', () => ({
    safeSupabaseQuery: vi.fn().mockResolvedValue([]),
    safeSupabaseRpc: vi.fn().mockResolvedValue({
        revenue: 5000000, count: 10, cash: 3000000, qris: 1500000, transfer: 500000,
        revenueBarang: 4000000, revenueJasa: 1000000,
    }),
}));

vi.mock('../../lib/utils', () => ({
    exportToCSV: vi.fn(),
    getDateRange: vi.fn(() => {
        const today = new Date();
        return { from: today, to: today };
    }),
    formatPaymentMethod: vi.fn((m) => m),
    cn: (...args) => args.filter(Boolean).join(' '),
}));

vi.mock('jspdf', () => ({
    default: vi.fn().mockImplementation(() => ({
        setFontSize: vi.fn(), text: vi.fn(), save: vi.fn(), addPage: vi.fn(),
    }))
}));

vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

vi.mock('lucide-react', () => ({
    DollarSign: () => <span />, TrendingUp: () => <span />, ShoppingBag: () => <span />,
    TrendingDown: () => <span />, Download: () => <span />, Eye: () => <span />,
    XCircle: () => <span />, AlertTriangle: () => <span />, ArrowUp: () => <span />,
    ArrowDown: () => <span />, ArrowUpDown: () => <span />, Search: () => <span />,
    RefreshCw: () => <span />, Calendar: () => <span />,
}));

vi.mock('../../components/ui/info-card', () => ({
    InfoCard: ({ title, value }) => (
        <div data-testid={`info-card-${title}`}><span>{title}</span><span>{value}</span></div>
    )
}));

vi.mock('../../components/ui/dialog', () => ({
    Dialog: ({ children }) => <div>{children}</div>,
    DialogContent: ({ children }) => <div>{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <div>{children}</div>,
    DialogFooter: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../components/ui/select', () => ({
    Select: ({ children, value, onValueChange }) => (
        <div>
            <select value={value} onChange={(e) => onValueChange && onValueChange(e.target.value)} data-testid="mock-select">
                {children}
            </select>
        </div>
    ),
    SelectTrigger: ({ children }) => <>{children}</>,
    SelectValue: ({ placeholder }) => <option value="">{placeholder}</option>,
    SelectContent: ({ children }) => <>{children}</>,
    SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
}));

vi.mock('../../components/ui/card', () => ({
    Card: ({ children, className }) => <div className={className}>{children}</div>,
    CardContent: ({ children }) => <div>{children}</div>,
    CardHeader: ({ children }) => <div>{children}</div>,
    CardTitle: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../components/SmartDatePicker', () => ({
    SmartDatePicker: ({ onDateChange }) => (
        <div data-testid="smart-date-picker">
            <button onClick={() => onDateChange({ from: new Date(), to: new Date() })}>Change</button>
        </div>
    )
}));

vi.mock('../../components/ReceiptModal', () => ({ default: () => <div data-testid="receipt-modal" /> }));

describe('ProfitLoss (Laporan Laba Rugi)', () => {
    const renderComponent = () =>
        render(<BrowserRouter><ProfitLoss /></BrowserRouter>);

    it('renders page heading', async () => {
        renderComponent();
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Laba Rugi/i })).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('renders date picker', async () => {
        renderComponent();
        await waitFor(() => {
            expect(screen.getByTestId('smart-date-picker')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('renders filter dropdowns', async () => {
        renderComponent();
        await waitFor(() => {
            const selects = screen.getAllByTestId('mock-select');
            expect(selects.length).toBeGreaterThan(0);
        }, { timeout: 3000 });
    });

    it('renders transaction table header with payment status column', async () => {
        renderComponent();
        await waitFor(() => {
            // "Status" column is unambiguous in ProfitLoss table header
            expect(screen.getAllByText(/Status/i).length).toBeGreaterThan(0);
        }, { timeout: 3000 });
    });

    it('[GOLDEN PATH REGRESSION GUARD] uses chunked fetching for transactions', async () => {
        // Prepare mock data: 1000 rows for the first chunk to trigger a second fetch
        const firstChunk = Array.from({ length: 1000 }, (_, i) => ({ id: `tx-${i}` }));
        const secondChunk = [{ id: 'tx-1001' }];

        mockRange
            .mockResolvedValueOnce({ data: firstChunk, error: null })
            .mockResolvedValueOnce({ data: secondChunk, error: null });

        renderComponent();

        // Wait for both chunks to be fetched
        await waitFor(() => {
            expect(mockRange).toHaveBeenCalledTimes(2);
        }, { timeout: 8000 });

        // Final check: table or count should reflect all 1001 transactions
        expect(screen.getByText(/1.001/)).toBeInTheDocument();
    });
});
