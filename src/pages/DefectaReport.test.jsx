import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DefectaReport from './DefectaReport';
import { vi, describe, it } from 'vitest';

// Mock the context
vi.mock('../context/DataContext', () => ({
    useData: () => ({
        products: [
            { id: 1, name: 'Paracetamol', stock: 5, min_stock: 10, isUnlimited: false, stockType: 'Barang' },
            { id: 2, name: null, stock: 0, min_stock: 5, isUnlimited: false, stockType: 'Barang' }
        ]
    })
}));

vi.mock('../hooks/useBusinessType', () => ({
    useBusinessType: () => ({
        term: (str) => str
    })
}));

describe('DefectaReport', () => {
    it('handles searching with null name', () => {
        render(
            <MemoryRouter>
                <DefectaReport />
            </MemoryRouter>
        );

        const input = screen.getByPlaceholderText('Cari obat / barang...');
        fireEvent.change(input, { target: { value: 'Para' } });
    });
});
