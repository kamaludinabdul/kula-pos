import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Transactions from './Transactions';
import { safeSupabaseRpc } from '../utils/supabaseHelper';


// Mock Contexts
vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', name: 'Test User', role: 'owner' },
        checkPermission: () => true,
    })
}));

vi.mock('../context/DataContext', () => ({
    useData: () => ({
        currentStore: { id: 'store-1', name: 'Test Store', settings: {} },
        voidTransaction: vi.fn(),
        processRefund: vi.fn(),
    })
}));

vi.mock('../context/ShiftContext', () => ({
    useShift: () => ({
        currentShift: { id: 'shift-1' },
        getShiftSummary: vi.fn(),
    })
}));

vi.mock('../hooks/useBusinessType', () => ({
    useBusinessType: () => ({
        term: (key) => {
            if (key === 'sale') return 'Transaksi';
            return key;
        },
        type: 'general'
    })
}));

// Mock Supabase Helper
vi.mock('../utils/supabaseHelper', () => ({
    safeSupabaseRpc: vi.fn(),
}));

// Mock Supabase
const mockTransactions = [
    { 
        id: 'tx-1', 
        date: new Date().toISOString(), 
        total: 10000, 
        status: 'completed', 
        payment_method: 'cash',
        items: [{ id: 'p1', name: 'Barang A', qty: 1, price: 10000, stockType: 'Barang' }] 
    },
    { 
        id: 'tx-2', 
        date: new Date().toISOString(), 
        total: 5000, 
        status: 'completed', 
        payment_method: 'qris',
        items: [{ id: 'p2', name: 'Jasa B', qty: 1, price: 5000, stockType: 'Jasa' }] 
    }
];

vi.mock('../supabase', () => {
    const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        // Make the query object thenable so it can be awaited
        then: vi.fn((resolve) => {
            resolve({
                data: mockTransactions,
                count: mockTransactions.length,
                error: null
            });
        })
    };
    return {
        supabase: {
            from: vi.fn(() => mockQuery),
        }
    };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Search: () => <div data-testid="icon-search" />,
    Filter: () => <div data-testid="icon-filter" />,
    Download: () => <div data-testid="icon-download" />,
    Trash2: () => <div data-testid="icon-trash" />,
    Edit: () => <div data-testid="icon-edit" />,
    Eye: () => <div data-testid="icon-eye" />,
    ChevronDown: () => <div data-testid="icon-chevron-down" />,
    RotateCcw: () => <div data-testid="icon-rotate-ccw" />,
    Ban: () => <div data-testid="icon-ban" />,
    ArrowUpDown: () => <div data-testid="icon-arrow-up-down" />,
    ArrowUp: () => <div data-testid="icon-arrow-up" />,
    ArrowDown: () => <div data-testid="icon-arrow-down" />,
    BookLock: () => <div data-testid="icon-book-lock" />,
    Wallet: () => <div data-testid="icon-wallet" />,
    TrendingUp: () => <div data-testid="icon-trending-up" />,
    TrendingDown: () => <div data-testid="icon-trending-down" />,
    Minus: () => <div data-testid="icon-minus" />,
    MoreVertical: () => <div data-testid="icon-more-vertical" />,
    RefreshCw: () => <div data-testid="icon-refresh-cw" />,
    Sparkles: () => <div data-testid="icon-sparkles" />,
    ShieldAlert: () => <div data-testid="icon-shield-alert" />,
    Lock: () => <div data-testid="icon-lock" />,
    Info: () => <div data-testid="icon-info" />,
    Loader2: () => <div data-testid="icon-loader" />,
    X: () => <div data-testid="icon-x" />,
}));

// Mock UI components directly to avoid Radix UI issues in JSDOM
vi.mock('../components/ui/dialog', () => ({
    Dialog: ({ children }) => <div data-testid="mock-dialog">{children}</div>,
    DialogContent: ({ children }) => <div data-testid="mock-dialog-content">{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <div>{children}</div>,
    DialogDescription: ({ children }) => <div>{children}</div>,
    DialogFooter: ({ children }) => <div>{children}</div>,
    DialogTrigger: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/ui/select', () => ({
    Select: ({ children, value, onValueChange }) => (
        <div data-testid="mock-select-container">
            <select value={value} onChange={(e) => onValueChange(e.target.value)} data-testid="mock-select">
                {/* We cannot render div inside select, so we strip children and just put a placeholder or let SelectItem do options. But SelectItem is mocked below to option. The Trigger and Content wrappers need to be fragments. */}
                {children}
            </select>
        </div>
    ),
    SelectTrigger: ({ children }) => <>{children}</>,
    SelectValue: ({ placeholder }) => <option value="" disabled>{placeholder}</option>,
    SelectContent: ({ children }) => <>{children}</>,
    SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
}));

vi.mock('../components/ui/card', () => ({
    Card: ({ children, className }) => <div className={className}>{children}</div>,
    CardHeader: ({ children }) => <div>{children}</div>,
    CardTitle: ({ children }) => <div>{children}</div>,
    CardContent: ({ children }) => <div>{children}</div>,
}));

// Mock InfoCard to ensure predictable rendering of currency and values
vi.mock('../components/ui/info-card', () => ({
    InfoCard: ({ title, value, isCurrency, description }) => (
        <div data-testid={`info-card-${title}`}>
            <span>{title}</span>
            <span>{isCurrency ? `Rp ${Number(value || 0).toLocaleString()}` : value}</span>
            {description && <span>{description}</span>}
        </div>
    )
}));

// Mock SmartDatePicker properly to avoid any issues with its internals
vi.mock('../components/SmartDatePicker', () => ({
    SmartDatePicker: ({ onDateChange }) => (
        <div data-testid="smart-date-picker">
            Date Picker
            <button onClick={() => onDateChange({ from: new Date(), to: new Date() })}>Change</button>
        </div>
    )
}));

vi.mock('../components/Pagination', () => ({
    default: () => <div data-testid="pagination">Pagination</div>
}));

describe('Transactions Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        
        // Mock RPC response for summary cards
        safeSupabaseRpc.mockImplementation((args) => {
            if (args.rpcName === 'get_transactions_report_stats') {
                // Return different values if filtered by Jasa to satisfy the filter test
                const isJasaFilter = args.params?.p_stock_type_filter === 'Jasa';
                return Promise.resolve({
                    revenue: 15000,
                    revenueBarang: isJasaFilter ? 0 : 10000,
                    revenueJasa: isJasaFilter ? 15000 : 5000,
                    count: 2,
                    cash: 10000,
                    qris: 5000,
                    transfer: 0
                });
            }
            return Promise.resolve(null);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders page header', async () => {
        render(
            <BrowserRouter>
                <Transactions />
            </BrowserRouter>
        );
        await act(async () => {
            vi.runAllTimers();
            await Promise.resolve();
            await Promise.resolve();
        });

        // Header Check synchronously
        const header = screen.getByRole('heading', { name: /Transaksi/i });
        expect(header).toBeInTheDocument();
    });

    it('renders summary cards with correct values', async () => {
        render(
            <BrowserRouter>
                <Transactions />
            </BrowserRouter>
        );

        await act(async () => {
            vi.runAllTimers();
            await Promise.resolve();
            await Promise.resolve();
        });

        // Check for specific cards using testid synchronously
        const salesCard = screen.getByTestId('info-card-Total Pendapatan');
        expect(salesCard).toHaveTextContent(/15/); 

        const barangCard = screen.getByTestId('info-card-Pendapatan Barang');
        expect(barangCard).toHaveTextContent(/10/);

        const jasaCard = screen.getByTestId('info-card-Pendapatan Jasa');
        expect(jasaCard).toHaveTextContent(/5/);
    });

    it('renders transactions list', async () => {
        render(
            <BrowserRouter>
                <Transactions />
            </BrowserRouter>
        );

        await act(async () => {
            vi.runAllTimers();
            await Promise.resolve();
            await Promise.resolve();
        });

        // Search for transaction ID synchronously
        const txIds = screen.getAllByText(/#tx-1/i);
        expect(txIds.length).toBeGreaterThan(0);
    });

    it('contains the "Tipe Stok" filter dropdown', async () => {
        render(
            <BrowserRouter>
                <Transactions />
            </BrowserRouter>
        );

        await act(async () => {
            vi.runAllTimers();
            await Promise.resolve();
            await Promise.resolve();
        });
        
        const selects = screen.getAllByTestId('mock-select');
        expect(selects.length).toBeGreaterThan(0);
        expect(screen.getByText(/Semua Stok/i)).toBeInTheDocument();
    });

    it('[LAYOUT REGRESSION GUARD] summary cards grid uses 4-column layout (not 7)', async () => {
        // This test explicitly guards against the accidental revert to xl:grid-cols-7 that caused
        // cards to overflow/get cut off on wide screens. If this test fails, it means the layout
        // was changed — review before merging.
        render(
            <BrowserRouter>
                <Transactions />
            </BrowserRouter>
        );

        await act(async () => {
            vi.runAllTimers();
            await Promise.resolve();
            await Promise.resolve();
        });

        const container = document.querySelector('[data-testid="summary-cards-container"]');
        expect(container).toBeInTheDocument();
        expect(container.className).toContain('xl:grid-cols-4');
        expect(container.className).not.toContain('xl:grid-cols-7');
    });

    it('updates summary stats when stock type filter is changed', async () => {
        render(
            <BrowserRouter>
                <Transactions />
            </BrowserRouter>
        );

        // Wait for initial load
        await act(async () => {
            vi.runAllTimers();
        });

        // Use test ID to avoid ambiguity with "pendapatan" in description
        expect(screen.getByTestId('info-card-Total Pendapatan')).toBeInTheDocument();

        // The Stock Type filter is the one containing the "Tipe Stok" option
        const selects = screen.getAllByTestId('mock-select');
        const stockSelect = selects.find(s => {
            return Array.from(s.options).some(opt => opt.text.includes('Tipe Stok'));
        });
        
        expect(stockSelect).toBeDefined();

        await act(async () => {
            // Change to 'Jasa'
            fireEvent.change(stockSelect, { target: { value: 'Jasa' } });
            // Advance timers to trigger the 300ms debounce in useEffect
            vi.advanceTimersByTime(350);
        });

        // After filtering for Jasa, the Items aggregation logic in fetchSummary 
        // will skip 'Barang' types, so revenueBarang becomes 0.
        const barangCard = screen.getByTestId('info-card-Pendapatan Barang');
        // According to mock InfoCard: <span>{title}</span><span>{value}</span>
        const valueSpan = barangCard.querySelectorAll('span')[1];
        expect(valueSpan.textContent).toContain('Rp 0');
    });
});
