import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TuslahReport from './TuslahReport';

// Mock contexts
vi.mock('../../context/DataContext', () => ({
    useData: () => ({
        transactions: [
            {
                id: 'TRX-001',
                date: new Date().toISOString(),
                status: 'completed',
                tuslah_fee: 2500,
                patient_name: 'Budi Santoso',
                doctor_name: 'Dr. Andi',
                prescription_number: 'R/123',
                total: 50000
            },
            {
                id: 'TRX-002',
                date: new Date().toISOString(),
                status: 'completed',
                tuslah_fee: 0, // Should be filtered out
                patient_name: 'Ani',
                total: 20000
            },
            {
                id: 'TRX-003',
                date: new Date().toISOString(),
                status: 'completed',
                tuslah_fee: 5000,
                patient_name: 'Candra',
                prescription_number: 'R/999',
                total: 100000
            }
        ]
    })
}));

vi.mock('../../hooks/useBusinessType', () => ({
    useBusinessType: () => ({
        isPharmacy: true
    })
}));

// Mock window.matchMedia if needed by shadcn
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

describe('TuslahReport', () => {
    it('renders report with calculated totals and filtered transactions', () => {
        render(<TuslahReport />);

        // Check Header
        expect(screen.getByText('Laporan Tuslah & Embalase')).toBeInTheDocument();

        // 2500 + 5000 = 7500
        expect(screen.getByText('Rp 7.500')).toBeInTheDocument();
        expect(screen.getByText(/Dari 2 transaksi/i)).toBeInTheDocument();

        // Check if only 2 valid transactions are in the table
        expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
        expect(screen.getByText('Candra')).toBeInTheDocument();
        expect(screen.queryByText('Ani')).not.toBeInTheDocument(); // tuslah_fee is 0

        expect(screen.getByText('Dr. Andi')).toBeInTheDocument();
        expect(screen.getByText(/Resep:\s*R\/123/i)).toBeInTheDocument();
        expect(screen.getByText(/Resep:\s*R\/999/i)).toBeInTheDocument();
        
        // Check formats
        expect(screen.getByText('+Rp 2.500')).toBeInTheDocument();
        expect(screen.getByText('+Rp 5.000')).toBeInTheDocument();
    });
});
