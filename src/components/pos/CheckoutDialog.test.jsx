import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CheckoutDialog from './CheckoutDialog';

vi.mock('../../hooks/useBusinessType', () => ({
    useBusinessType: () => ({
        term: (key) => key,
        isPharmacy: true
    })
}));

describe('CheckoutDialog (Pharmacy Features)', () => {
    let mockProps;

    beforeEach(() => {
        mockProps = {
            isOpen: true,
            onClose: vi.fn(),
            total: 50000,
            onProcessPayment: vi.fn(),
            paymentSuccess: false,
            onPrintReceipt: vi.fn(),
            onPrintEtiket: vi.fn(),
            onDownloadReceipt: vi.fn(),
            onCloseSuccess: vi.fn(),
            store: { name: 'Apotek Sehat' },
            lastTransaction: null,
            user: { role: 'staff' }
        };
    });

    it('renders correctly and accepts payment', () => {
        render(<CheckoutDialog {...mockProps} />);
        
        // Wait for cash input to be auto-focused or just find it
        const inputs = screen.getAllByRole('spinbutton');
        // Cash input is usually the first number input without a name but with placeholder 0
        const cashInput = inputs.find(i => i.placeholder === '0' || i.className.includes('pl-10'));
        expect(cashInput).toBeInTheDocument();

        fireEvent.change(cashInput, { target: { value: '50000' } });

        const processBtn = screen.getByText('Bayar');
        fireEvent.click(processBtn);

        expect(mockProps.onProcessPayment).toHaveBeenCalledWith(expect.objectContaining({
            paymentMethod: 'cash',
            cashAmount: 50000,
            change: 0
        }));
    });

    it('displays pharmacy data and print etiket button upon success', () => {
        mockProps.paymentSuccess = true;
        mockProps.lastTransaction = {
            id: 'TRX-123',
            total: 50000,
            patient_name: 'Budi',
            doctor_name: 'Dr. Andi',
            prescription_number: 'R/456',
            tuslah_fee: 2000,
            items: [
                { name: 'Paracetamol', qty: 1, price: 10000, discount: 0 }
            ]
        };

        render(<CheckoutDialog {...mockProps} />);

        // Verify success view
        expect(screen.getByText('Pembayaran Berhasil!')).toBeInTheDocument();

        // Verify receipt contains pharmacy data
        expect(screen.getByText(/Pasien:\s*Budi/i)).toBeInTheDocument();
        expect(screen.getByText(/Dokter:\s*Dr\. Andi/i)).toBeInTheDocument();
        expect(screen.getByText(/No\. Resep:\s*R\/456/i)).toBeInTheDocument();
        expect(screen.getByText(/Biaya Tuslah\/Embalase/i)).toBeInTheDocument();

        // Verify "Cetak Etiket Obat" button exists
        const cetakEtiketBtn = screen.getByText(/Cetak Etiket Obat/i);
        expect(cetakEtiketBtn).toBeInTheDocument();

        // Simulate click
        fireEvent.click(cetakEtiketBtn);
        expect(mockProps.onPrintEtiket).toHaveBeenCalledTimes(1);
    });
});
