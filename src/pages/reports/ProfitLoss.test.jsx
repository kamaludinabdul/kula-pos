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
        return { startDate: today, endDate: today };
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
});
