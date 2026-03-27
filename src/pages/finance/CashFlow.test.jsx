import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import CashFlow from './CashFlow';

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'owner', name: 'Owner Test' },
        checkPermission: () => true,
    })
}));

vi.mock('../../context/DataContext', () => ({
    useData: () => ({
        currentStore: { id: 'store-1', name: 'Test Store' },
    })
}));

vi.mock('../../utils/supabaseHelper', () => ({
    safeSupabaseQuery: vi.fn().mockResolvedValue([
        {
            id: 'cf-1', store_id: 'store-1', type: 'out', category: 'Operasional',
            expense_group: 'operational', amount: 250000,
            description: 'Beli listrik', date: new Date().toISOString(), created_by_name: 'Owner Test',
        }
    ]),
}));

vi.mock('../../lib/utils', () => ({
    getDateRange: vi.fn(() => {
        const today = new Date();
        return { startDate: today, endDate: today };
    }),
    cn: (...args) => args.filter(Boolean).join(' '),
    exportToCSV: vi.fn(),
}));

vi.mock('date-fns', () => ({
    format: (date) => date?.toString() || '',
    startOfMonth: (d) => d,
    endOfMonth: (d) => d,
}));

vi.mock('date-fns/locale', () => ({ id: {} }));

vi.mock('lucide-react', () => ({
    Plus: () => <span />, Trash2: () => <span />, TrendingUp: () => <span />,
    TrendingDown: () => <span />, DollarSign: () => <span />, RefreshCw: () => <span />,
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
    DialogTrigger: ({ children }) => <>{children}</>,
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

vi.mock('../../components/ui/textarea', () => ({
    Textarea: (props) => <textarea {...props} />,
}));

vi.mock('../../components/SmartDatePicker', () => ({
    SmartDatePicker: ({ onDateChange }) => (
        <div data-testid="smart-date-picker">
            <button onClick={() => onDateChange({ from: new Date(), to: new Date() })}>Change</button>
        </div>
    )
}));

vi.mock('../../components/ConfirmDialog', () => ({ default: () => <div data-testid="confirm-dialog" /> }));
vi.mock('../../components/ui/FormattedNumberInput', () => ({
    default: (props) => <input type="number" {...props} />,
}));

describe('CashFlow (Arus Kas)', () => {
    const renderComponent = () =>
        render(<BrowserRouter><CashFlow /></BrowserRouter>);

    it('renders page heading', async () => {
        renderComponent();
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: /Arus Kas/i })).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('renders Summary InfoCards', async () => {
        renderComponent();
        await waitFor(() => {
            const allCards = document.querySelectorAll('[data-testid^="info-card-"]');
            expect(allCards.length).toBeGreaterThan(0);
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

    it('renders the Tambah button to add a cash entry', async () => {
        renderComponent();
        await waitFor(() => {
            expect(screen.getByText(/Tambah/i)).toBeInTheDocument();
        }, { timeout: 3000 });
    });
});
