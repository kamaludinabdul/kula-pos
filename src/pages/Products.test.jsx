import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Products from './Products';

vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'owner' },
        checkPermission: () => true,
    })
}));

vi.mock('../context/DataContext', () => ({
    useData: () => ({
        currentStore: { id: 'store-1', name: 'Test Store', settings: {} },
        activeStoreId: 'store-1',
        stores: [],
        categories: [
            { id: 'cat-1', name: 'Makanan' },
            { id: 'cat-2', name: 'Obat' },
        ],
        deleteProduct: vi.fn().mockResolvedValue(true),
        bulkAddProducts: vi.fn().mockResolvedValue({ added: 0, errors: [] }),
        fetchProductsPage: vi.fn().mockResolvedValue({ data: [], total: 0 }),
        fetchAllProducts: vi.fn().mockResolvedValue([]),
    })
}));

vi.mock('../hooks/useBusinessType', () => ({
    useBusinessType: () => ({ term: (k) => k, type: 'general' })
}));

vi.mock('../utils/supabaseHelper', () => ({
    safeSupabaseRpc: vi.fn().mockResolvedValue({
        data: [
            { id: 'prod-1', name: 'Pakan Kucing', price: 50000, stock: 10, stock_type: 'Barang', category_id: 'cat-1', sku: 'SKU-001' },
            { id: 'prod-2', name: 'Vaksin Rabies', price: 150000, stock: 5, stock_type: 'Jasa', category_id: 'cat-2', sku: 'SKU-002' },
        ],
        total: 2
    }),
}));

vi.mock('../utils/supabaseImage', () => ({
    getOptimizedImage: vi.fn((url) => url || ''),
}));

vi.mock('../utils/plans', () => ({
    hasFeatureAccess: vi.fn().mockReturnValue(true),
}));

vi.mock('../utils/ai', () => ({
    getPricingInsights: vi.fn().mockResolvedValue({ insights: [] }),
}));

vi.mock('lucide-react', () => ({
    Search: () => <span />, Plus: () => <span />, Upload: () => <span />, Trash2: () => <span />,
    Edit: () => <span />, MoreVertical: () => <span />, FileDown: () => <span />,
    ArrowUpDown: () => <span />, ArrowUp: () => <span />, ArrowDown: () => <span />,
    Printer: () => <span />, Package: () => <span />, Copy: () => <span />,
    RefreshCw: () => <span />, Sparkles: () => <span />, Lock: () => <span />, Loader2: () => <span />,
}));

vi.mock('../components/ui/dialog', () => ({
    Dialog: ({ children }) => <div>{children}</div>,
    DialogContent: ({ children }) => <div>{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <div>{children}</div>,
    DialogDescription: ({ children }) => <div>{children}</div>,
    DialogFooter: ({ children }) => <div>{children}</div>,
    DialogTrigger: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/ui/select', () => ({
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

vi.mock('../components/ui/card', () => ({
    Card: ({ children, className }) => <div className={className}>{children}</div>,
    CardContent: ({ children }) => <div>{children}</div>,
    CardHeader: ({ children }) => <div>{children}</div>,
    CardTitle: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/ui/badge', () => ({
    Badge: ({ children, className }) => <span className={className}>{children}</span>,
}));

vi.mock('../components/ui/checkbox', () => ({
    Checkbox: (props) => <input type="checkbox" {...props} />,
}));

vi.mock('../components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
    DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/AlertDialog', () => ({ default: () => <div data-testid="alert-dialog" /> }));
vi.mock('../components/ConfirmDialog', () => ({ default: () => <div data-testid="confirm-dialog" /> }));
vi.mock('../components/BarcodeLabelDialog', () => ({ default: () => <div data-testid="barcode-dialog" /> }));
vi.mock('../components/Pagination', () => ({ default: () => <div data-testid="pagination" /> }));

vi.mock('papaparse', () => ({ default: { parse: vi.fn() } }));
vi.mock('xlsx', () => ({
    read: vi.fn(), utils: { sheet_to_json: vi.fn(), book_new: vi.fn(), book_append_sheet: vi.fn() }, writeFile: vi.fn()
}));
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, useNavigate: () => vi.fn() };
});

describe('Products Page', () => {
    const renderComponent = () =>
        render(<BrowserRouter><Products /></BrowserRouter>);

    it('renders the page heading', async () => {
        renderComponent();
        await waitFor(() => {
            const heading = screen.getByRole('heading');
            expect(heading).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('renders a search input', async () => {
        renderComponent();
        await waitFor(() => {
            const searchInput = screen.getByRole('textbox');
            expect(searchInput).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('renders category filter dropdown', async () => {
        renderComponent();
        await waitFor(() => {
            const selects = screen.getAllByTestId('mock-select');
            expect(selects.length).toBeGreaterThan(0);
        }, { timeout: 3000 });
    });

    it('renders the table structure (Status Stok column header)', async () => {
        renderComponent();
        await waitFor(() => {
            // "Status Stok" is a unique column header only appearing in the Products table
            expect(screen.getByText(/Status Stok/i)).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('renders pagination component', async () => {
        renderComponent();
        await waitFor(() => {
            expect(screen.getByTestId('pagination')).toBeInTheDocument();
        }, { timeout: 3000 });
    });
});
