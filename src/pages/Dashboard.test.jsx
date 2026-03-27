import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from './Dashboard';

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'owner', permissions: [] },
        checkPermission: () => true,
    })
}));

vi.mock('../context/DataContext', () => ({
    useData: () => ({
        currentStore: { id: 'store-1', name: 'Test Store', settings: {} },
        activeStoreId: 'store-1',
        products: [{ id: 'p1', name: 'P1', stock: 5 }],
        fetchAllProducts: vi.fn().mockResolvedValue([]),
    })
}));

vi.mock('../hooks/useBusinessType', () => ({
    useBusinessType: () => ({ term: (k) => k, type: 'general' })
}));

vi.mock('../utils/supabaseHelper', () => ({
    safeSupabaseRpc: vi.fn().mockResolvedValue({
        totalSales: 10000000, totalTransactions: 50, avgOrder: 200000,
        totalProfit: 3000000, totalGrossProfit: 4000000, totalNetProfit: 3000000,
        chartData: [], categoryData: [], topProducts: [], recentTransactions: []
    }),
}));

vi.mock('../lib/utils', () => ({
    formatCompactNumber: (v) => `${v}`,
    cn: (...args) => args.filter(Boolean).join(' '),
    getDateRange: vi.fn(() => {
        const today = new Date();
        return { startDate: today, endDate: today };
    }),
}));

vi.mock('lucide-react', () => ({
    DollarSign: () => <span />, ShoppingBag: () => <span />, Users: () => <span />,
    TrendingUp: () => <span />, Eye: () => <span />, AlertTriangle: () => <span />,
    Package: () => <span />, BrainCircuit: () => <span />,
}));

vi.mock('../components/ui/info-card', () => ({
    InfoCard: ({ title, value }) => (
        <div data-testid={`info-card-${title}`}><span>{title}</span><span>{value}</span></div>
    )
}));

vi.mock('../components/ui/card', () => ({
    Card: ({ children, className }) => <div className={className}>{children}</div>,
    CardContent: ({ children }) => <div>{children}</div>,
    CardHeader: ({ children }) => <div>{children}</div>,
    CardTitle: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/ReceiptModal', () => ({
    default: () => <div data-testid="receipt-modal" />,
}));

vi.mock('../components/SmartDatePicker', () => ({
    SmartDatePicker: ({ onDateChange }) => (
        <div data-testid="smart-date-picker">
            <button onClick={() => onDateChange({ from: new Date(), to: new Date() })}>Change</button>
        </div>
    )
}));

vi.mock('./dashboard-components/DashboardCharts', () => ({
    default: () => <div data-testid="dashboard-charts" />,
}));

vi.mock('recharts', () => ({
    AreaChart: ({ children }) => <div>{children}</div>, Area: () => <div />,
    LineChart: ({ children }) => <div>{children}</div>, Line: () => <div />,
    ComposedChart: ({ children }) => <div>{children}</div>,
    XAxis: () => <div />, YAxis: () => <div />, CartesianGrid: () => <div />,
    Tooltip: () => <div />, ResponsiveContainer: ({ children }) => <div>{children}</div>,
    PieChart: ({ children }) => <div>{children}</div>, Pie: () => <div />,
    Cell: () => <div />, Legend: () => <div />,
}));

describe('Dashboard', () => {
    it('renders without crashing', async () => {
        let error;
        try {
            const { unmount } = render(<BrowserRouter><Dashboard /></BrowserRouter>);
            await waitFor(() => {
                expect(screen.getByText('Dashboard')).toBeInTheDocument();
            }, { timeout: 3000 });
            unmount();
        } catch (e) {
            error = e;
        }
        expect(error).toBeUndefined();
    });

    it('renders date picker', async () => {
        render(<BrowserRouter><Dashboard /></BrowserRouter>);
        await waitFor(() => {
            expect(screen.getByTestId('smart-date-picker')).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('renders DashboardCharts component', async () => {
        render(<BrowserRouter><Dashboard /></BrowserRouter>);
        await waitFor(() => {
            expect(screen.getByTestId('dashboard-charts')).toBeInTheDocument();
        }, { timeout: 3000 });
    });
});
