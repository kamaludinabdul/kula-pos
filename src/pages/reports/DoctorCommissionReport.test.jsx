import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DoctorCommissionReport from './DoctorCommissionReport';
import { safeSupabaseRpc } from '../../utils/supabaseHelper';

// Mock contexts
vi.mock('../../context/DataContext', () => ({
    useData: () => ({
        currentStore: { id: 'store-123' }
    })
}));

// Mock Supabase Helper
vi.mock('../../utils/supabaseHelper', () => ({
    safeSupabaseRpc: vi.fn()
}));

// Mock SmartDatePicker to avoid complex date lib issues in vitest
vi.mock('../../components/SmartDatePicker', () => ({
    SmartDatePicker: () => <div data-testid="smart-date-picker" />
}));

// Mock jspdf and xlsx if needed to avoid environment issues in test
vi.mock('jspdf', () => ({
    jsPDF: vi.fn()
}));
vi.mock('xlsx', () => ({
    utils: {},
    writeFile: vi.fn()
}));

// Mock window.matchMedia if needed by shadcn
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

describe('DoctorCommissionReport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders report with calculated commissions', async () => {
        safeSupabaseRpc.mockResolvedValue([
            {
                staff_id: 'doc-1',
                staff_name: 'Dr. Andi',
                staff_role: 'dokter',
                total_items: 2,
                total_commission: 50000,
                item_details: [
                    {
                        item_name: 'Konsultasi',
                        role_context: 'Dokter Utama',
                        qty: 1,
                        price: 150000,
                        commission: 30000,
                        patient_name: 'Molly',
                        date: new Date().toISOString()
                    },
                    {
                        item_name: 'Vaksinasi',
                        role_context: 'Dokter Pendamping',
                        qty: 1,
                        price: 100000,
                        commission: 20000,
                        patient_name: 'Buster',
                        date: new Date().toISOString()
                    }
                ]
            }
        ]);

        render(<DoctorCommissionReport />);

        // Check if loading state vanishes and data appears
        expect(await screen.findByText(/Dr\. Andi/i)).toBeInTheDocument();

        // Check totals
        expect(screen.getAllByText('Rp 50.000').length).toBeGreaterThan(0);
        // Assert API was called correctly
        expect(safeSupabaseRpc).toHaveBeenCalledWith(expect.objectContaining({
            rpcName: 'get_all_commissions_report'
        }));
    });

    it('displays empty state when no data', async () => {
        safeSupabaseRpc.mockResolvedValue([]);

        render(<DoctorCommissionReport />);

        expect(await screen.findByText(/Belum ada data komisi pada periode ini/i)).toBeInTheDocument();
    });
});
