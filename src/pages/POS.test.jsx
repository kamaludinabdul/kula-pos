import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import POS from './POS';

// ─────────────────────────────────────────────────────────────────
// Mock ProductGrid with a simple clickable list — no IntersectionObserver needed
// onAddToCart is wired to each product button so we can test cart interactions
// ─────────────────────────────────────────────────────────────────
vi.mock('../components/pos/ProductGrid', () => ({
    default: ({ products, onAddToCart }) => (
        <div data-testid="mock-product-grid">
            {products?.map(p => (
                <button
                    key={p.id}
                    data-testid={`product-${p.id}`}
                    onClick={() => onAddToCart(p)}
                >
                    {p.name}
                </button>
            ))}
        </div>
    )
}));

// Mock CartPanel to expose a simple checkout button without complex rendering
vi.mock('../components/pos/CartPanel', () => ({
    default: ({ cart, totals, onCheckout }) => (
        <div data-testid="mock-cart-panel">
            <span data-testid="cart-count">{cart?.length || 0} item</span>
            <span data-testid="cart-total">{totals?.finalTotal}</span>
            <button data-testid="bayar-button" onClick={onCheckout}>
                Bayar ({cart?.length || 0})
            </button>
        </div>
    )
}));

// ─────────────────────────────────────────────────────────────────
// Mock Contexts
// ─────────────────────────────────────────────────────────────────
vi.mock('../context/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id', name: 'Test User' },
        logout: vi.fn(),
    })
}));

vi.mock('../context/DataContext', () => ({
    useData: () => ({
        products: [
            { id: '1', name: 'Kopi Susu', price: 20000, sellPrice: 20000, storeId: 'store-1', type: 'product' },
            { id: '2', name: 'Roti Bakar', price: 15000, sellPrice: 15000, storeId: 'store-1', type: 'product' }
        ],
        categories: [
            { id: 'c1', name: 'Minuman' },
            { id: 'c2', name: 'Makanan' },
        ],
        currentStore: { id: 'store-1', name: 'Toko Test', settings: {} },
        customers: [],
        processSale: vi.fn().mockResolvedValue({ success: true, transactionId: 'tx-123' }),
        fetchAllProducts: vi.fn(),
        fetchUsersByStore: vi.fn().mockResolvedValue([]),
        isOnline: true,
    })
}));

vi.mock('../context/ShiftContext', () => ({
    useShift: () => ({
        currentShift: { id: 'shift-1', status: 'open' },
        startShift: vi.fn(),
        endShift: vi.fn(),
        updateShiftStats: vi.fn(),
        getShiftSummary: vi.fn()
    })
}));

// ─────────────────────────────────────────────────────────────────
// Mock usePOS Hook — controls all cart/product state for UI tests
// ─────────────────────────────────────────────────────────────────
const mockAddToCart = vi.fn();
const mockSetDiscountType = vi.fn();
const mockSetDiscountValue = vi.fn();
const mockClearCart = vi.fn();

const mockFilteredProducts = [
    { id: '1', name: 'Kopi Susu', price: 20000, sellPrice: 20000, category_id: 'c1', stock: 10, has_stock: true, is_deleted: false, storeId: 'store-1', type: 'product' },
    { id: '2', name: 'Roti Bakar', price: 15000, sellPrice: 15000, category_id: 'c2', stock: 5, has_stock: true, is_deleted: false, storeId: 'store-1', type: 'product' }
];

vi.mock('../hooks/usePOS', () => ({
    usePOS: () => ({
        cart: [{ id: '1', name: 'Kopi Susu', price: 20000, qty: 1, subtotal: 20000 }],
        setCart: vi.fn(),
        activeCategory: 'all',
        setActiveCategory: vi.fn(),
        searchQuery: '',
        setSearchQuery: vi.fn(),
        selectedCustomer: null,
        setSelectedCustomer: vi.fn(),
        discountType: 'percentage',
        setDiscountType: mockSetDiscountType,
        discountValue: 0,
        setDiscountValue: mockSetDiscountValue,
        appliedPromoId: null,
        setAppliedPromoId: vi.fn(),
        salesPerson: '',
        setSalesPerson: vi.fn(),
        filteredProducts: mockFilteredProducts,
        totals: { rawTotal: 20000, subtotal: 20000, discountAmount: 0, tax: 0, serviceCharge: 0, finalTotal: 20000 },
        recommendedItems: [],
        promotions: [],
        activePromotions: [],
        availablePromos: [],
        addToCart: mockAddToCart,
        updateQty: vi.fn(),
        updateCartItem: vi.fn(),
        clearCart: mockClearCart,
        paymentMethod: 'cash',
        setPaymentMethod: vi.fn(),
        cashAmount: '',
        setCashAmount: vi.fn(),
    })
}));

// ─────────────────────────────────────────────────────────────────
// Mock Services
// ─────────────────────────────────────────────────────────────────
vi.mock('../services/printer', () => ({
    printerService: {
        printReceipt: vi.fn().mockResolvedValue(true),
        isConnected: vi.fn().mockReturnValue(false),
        // Return a synchronous-style resolved promise to prevent act() warnings
        autoConnect: vi.fn().mockReturnValue(Promise.resolve({ success: false })),
        getDeviceName: vi.fn().mockReturnValue(null),
    }
}));

vi.mock('../lib/receiptHelper', () => ({
    printReceiptBrowser: vi.fn()
}));

vi.mock('../services/telegram', () => ({
    sendTransactionToTelegram: vi.fn()
}));

// ─────────────────────────────────────────────────────────────────
// Mock supabase to prevent connection attempts
// ─────────────────────────────────────────────────────────────────
vi.mock('../supabase', () => ({
    supabase: {
        channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
        removeChannel: vi.fn(),
        auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) }
    }
}));

// IntersectionObserver mock (no setTimeout needed — ProductGrid is mocked)
class MockIntersectionObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
}
window.IntersectionObserver = MockIntersectionObserver;

// ─────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────
const renderWithRouter = (component) => render(
    <BrowserRouter>{component}</BrowserRouter>
);

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────
describe('POS Component UI Flow', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(async () => {
        // Flush any pending promises/state updates to avoid act() warnings
        await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('renders Header, Product Grid, and Cart Panel', async () => {
        renderWithRouter(<POS />);

        // Header shows store name
        expect(screen.getByText(/Toko Test/i)).toBeInTheDocument();

        // Product grid shows products
        expect(screen.getByTestId('mock-product-grid')).toBeInTheDocument();
        expect(screen.getByText(/Kopi Susu/i)).toBeInTheDocument();
        expect(screen.getByText(/Roti Bakar/i)).toBeInTheDocument();

        // Cart panel is visible
        expect(screen.getByTestId('mock-cart-panel')).toBeInTheDocument();

        // Bayar button is present
        expect(screen.getByTestId('bayar-button')).toBeInTheDocument();
    });

    it('calls addToCart when a product card is clicked', async () => {
        renderWithRouter(<POS />);

        // "Roti Bakar" button rendered by mock ProductGrid
        const rotiBakarBtn = screen.getByTestId('product-2');
        fireEvent.click(rotiBakarBtn);

        expect(mockAddToCart).toHaveBeenCalledWith(
            expect.objectContaining({ id: '2', name: 'Roti Bakar' })
        );
    });

    it('opens CheckoutDialog when Bayar button is clicked', async () => {
        renderWithRouter(<POS />);

        // Click the Bayar button exposed by mock CartPanel
        const bayarButton = screen.getByTestId('bayar-button');
        fireEvent.click(bayarButton);

        // CheckoutDialog should open
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    it('shows cart item count in cart panel', () => {
        renderWithRouter(<POS />);

        // Cart has 1 item from our mocked usePOS state
        expect(screen.getByTestId('cart-count')).toHaveTextContent('1 item');
    });
});
