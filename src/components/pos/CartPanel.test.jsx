import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CartPanel from './CartPanel';

// Mock the useBusinessType hook
vi.mock('../../hooks/useBusinessType', () => ({
    useBusinessType: () => ({
        term: (key) => key,
        hasFeature: (feature) => feature === 'prescriptions' // Enable pharmacy features for test
    })
}));

describe('CartPanel (Pharmacy Features)', () => {
    let mockProps;

    beforeEach(() => {
        mockProps = {
            cart: [
                {
                    id: 'item1',
                    name: 'Paracetamol',
                    price: 10000,
                    qty: 1,
                    unit: 'Strip',
                    aturanPakai: ''
                }
            ],
            onUpdateQty: vi.fn(),
            onUpdateItem: vi.fn(),
            onClearCart: vi.fn(),
            totals: { subtotal: 10000, tax: 0, discountAmount: 0, finalTotal: 10000 },
            selectedCustomer: null,
            customers: [],
            onSelectCustomer: vi.fn(),
            onCheckout: vi.fn(),
            discountType: 'percentage',
            discountValue: 0,
            onDiscountChange: vi.fn(),
            enableDiscount: true,
            recommendations: [],
            onAddRecommendation: vi.fn(),
            enableSalesPerformance: false,
            salesUsers: [],
            salesPerson: null,
            onSelectSalesPerson: vi.fn(),
            appliedPromoId: null,
            availablePromos: [],
            onApplyPromo: vi.fn(),
            onCollapse: vi.fn(),
            loyaltySettings: { isActive: false },
            onAddCustomer: vi.fn(),
            prescriptionData: {
                patientName: '',
                doctorName: '',
                prescriptionNumber: '',
                tuslahFee: 0
            },
            setPrescriptionData: vi.fn(),
            onUpdateItemUnit: vi.fn(),
            products: [],
            onAddToCart: vi.fn()
        };
    });

    it('renders prescription data fields when cart has items and feature is enabled', () => {
        render(<CartPanel {...mockProps} />);

        // Verify Data Resep section is visible
        expect(screen.getByText(/Data Resep/i)).toBeInTheDocument();
        
        // Check for specific input fields
        expect(screen.getByPlaceholderText('Nama Pasien')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Nama Dokter')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Cth: R/123')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('0')).toBeInTheDocument(); // Tuslah fee
    });

    it('updates prescription data when user types', () => {
        render(<CartPanel {...mockProps} />);

        const patientInput = screen.getByPlaceholderText('Nama Pasien');
        fireEvent.change(patientInput, { target: { value: 'Budi' } });

        expect(mockProps.setPrescriptionData).toHaveBeenCalledWith({
            patientName: 'Budi',
            doctorName: '',
            prescriptionNumber: '',
            tuslahFee: 0
        });

        const doctorInput = screen.getByPlaceholderText('Nama Dokter');
        fireEvent.change(doctorInput, { target: { value: 'Dr. Andi' } });

        expect(mockProps.setPrescriptionData).toHaveBeenCalledWith({
            patientName: '',
            doctorName: 'Dr. Andi',
            prescriptionNumber: '',
            tuslahFee: 0
        });
    });

    it('renders and applies aturan pakai shortcuts for cart items', () => {
        render(<CartPanel {...mockProps} />);

        // The item Paracetamol is in the cart
        expect(screen.getByText('Paracetamol')).toBeInTheDocument();

        // Check if shortcuts exist
        const shortcut3x1 = screen.getByText('3x1');
        expect(shortcut3x1).toBeInTheDocument();

        // Click a shortcut
        fireEvent.click(shortcut3x1);

        // Should call onUpdateItem with the correct id and payload
        expect(mockProps.onUpdateItem).toHaveBeenCalledWith('item1', { aturanPakai: '3x1' });
    });

    it('allows typing custom aturan pakai', () => {
        render(<CartPanel {...mockProps} />);

        const aturanInput = screen.getByPlaceholderText('Aturan Pakai (Cth: 3 x 1 Tablet Sesudah Makan)');
        fireEvent.change(aturanInput, { target: { value: '1x1 Malam' } });

        expect(mockProps.onUpdateItem).toHaveBeenCalledWith('item1', { aturanPakai: '1x1 Malam' });
    });
});
