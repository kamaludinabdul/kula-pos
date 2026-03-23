import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompoundingDialog from './CompoundingDialog';

// Mock dependencies if needed to avoid rendering issues
const mockProducts = [
    { id: 'p1', name: 'Paracetamol', price: 5000, buyPrice: 2000, sellPrice: 5000, stock: 100, unit: 'Tablet' },
    { id: 'p2', name: 'Amoxicillin', price: 10000, buyPrice: 6000, sellPrice: 10000, stock: 50, unit: 'Kapsul' },
    { id: 'p3', name: 'Sirup ABC', price: 15000, buyPrice: 10000, sellPrice: 15000, stock: 10, unit: 'Botol' },
];

describe('CompoundingDialog (Racikan)', () => {
    let mockOnClose;
    let mockOnAddToCart;

    beforeEach(() => {
        mockOnClose = vi.fn();
        mockOnAddToCart = vi.fn();
    });

    const renderDialog = (isOpen = true) => {
        return render(
            <CompoundingDialog
                isOpen={isOpen}
                onClose={mockOnClose}
                products={mockProducts}
                onAddToCart={mockOnAddToCart}
            />
        );
    };

    it('renders the dialog correctly when isOpen is true', () => {
        renderDialog();
        expect(screen.getByText('Buat Obat Racikan')).toBeInTheDocument();
        expect(screen.getByText('Nama Racikan')).toBeInTheDocument();
    });

    it('allows searching and adding ingredients', async () => {
        renderDialog();
        
        // Search for Paracetamol
        const searchInput = screen.getByPlaceholderText('Ketik nama obat...');
        fireEvent.change(searchInput, { target: { value: 'Para' } });

        // Wait for search results
        await waitFor(() => {
            expect(screen.getByText('Paracetamol')).toBeInTheDocument();
        });

        // Click to add
        fireEvent.click(screen.getByText('Paracetamol'));

        // It should appear in the selected ingredients list
        expect(screen.getByText(/Daftar Bahan/)).toHaveTextContent('(1)');
        
        // Modal & Potensi Laba assertions (Total cost = 2000, Sell = 5000, Profit = 3000)
        expect(screen.getByText('Rp 2,000')).toBeInTheDocument(); // Modal/COGS
        // The input value for sell price should be 5000
        const sellInput = screen.getByDisplayValue('5000');
        expect(sellInput).toBeInTheDocument();
        
        expect(screen.getByText('Rp 3,000')).toBeInTheDocument(); // Profit
    });

    it('updates quantity and recalculates correctly', async () => {
        renderDialog();
        
        // Add Amoxicillin
        const searchInput = screen.getByPlaceholderText('Ketik nama obat...');
        fireEvent.change(searchInput, { target: { value: 'Amox' } });
        await waitFor(() => screen.getByText('Amoxicillin'));
        fireEvent.click(screen.getByText('Amoxicillin'));

        // By default qty is 1, so sell is 10000, profit is 4000
        // Change qty to 2
        const qtyInputs = screen.getAllByRole('spinbutton');
        // The first input is search (wait, type="number" are qty and sellPrice)
        // Let's target the qty input specifically
        const amoxQtyInput = qtyInputs[0]; // Assuming it's the first number input before the sell price input
        fireEvent.change(amoxQtyInput, { target: { value: '2' } });

        // Total modal = 12000, sell = 20000, profit = 8000
        expect(screen.getByText('Rp 12,000')).toBeInTheDocument(); // COGS
        // Wait for render update
        await waitFor(() => {
            expect(screen.getByDisplayValue('20000')).toBeInTheDocument();
        });
        expect(screen.getByText('Rp 8,000')).toBeInTheDocument(); // Profit
    });

    it('can remove an ingredient', async () => {
        renderDialog();
        
        fireEvent.change(screen.getByPlaceholderText('Ketik nama obat...'), { target: { value: 'Sirup' } });
        await waitFor(() => screen.getByText('Sirup ABC'));
        fireEvent.click(screen.getByText('Sirup ABC'));

        expect(screen.getByText(/Daftar Bahan/)).toHaveTextContent('(1)');

        // Click remove (Trash2 icon wrapper -> Button)
        const removeBtns = screen.queryAllByRole('button').filter(b => b.className.includes('hover:text-red-500'));
        fireEvent.click(removeBtns[0]);

        // List should be empty
        expect(screen.getByText('Belum ada bahan baku')).toBeInTheDocument();
        expect(screen.getByText(/Daftar Bahan/)).toHaveTextContent('(0)');
    });

    it('submits correctly constructed racikanItem logic (NO isUnlimited flag)', async () => {
        renderDialog();
        
        // Set Racikan Name
        const nameInput = screen.getByDisplayValue('Racikan Baru');
        fireEvent.change(nameInput, { target: { value: 'Puyer Demam' } });

        // Add Paracetamol
        fireEvent.change(screen.getByPlaceholderText('Ketik nama obat...'), { target: { value: 'Para' } });
        await waitFor(() => screen.getByText('Paracetamol'));
        fireEvent.click(screen.getByText('Paracetamol'));

        // Submit
        const submitBtn = screen.getByText('Tambah ke Keranjang');
        fireEvent.click(submitBtn);

        expect(mockOnAddToCart).toHaveBeenCalledTimes(1);
        
        // Retrieve arguments passed to mock
        const addedItem = mockOnAddToCart.mock.calls[0][0];

        expect(addedItem.name).toBe('Puyer Demam');
        expect(addedItem.type).toBe('racikan');
        expect(addedItem.price).toBe(5000);
        expect(addedItem.unit).toBe('Paket');
        expect(addedItem.qty).toBe(1);
        expect(addedItem.ingredients).toHaveLength(1);
        
        // Verify ingredient structure
        const ingredient = addedItem.ingredients[0];
        expect(ingredient.id).toBe('p1');
        expect(ingredient.name).toBe('Paracetamol');
        expect(ingredient.qty).toBe(1);
        expect(ingredient.unit).toBe('Tablet');

        // CRITICAL BUG FIX CHECK: isUnlimited MUST NOT be true or exist
        expect(ingredient.isUnlimited).toBeUndefined();
    });
});
