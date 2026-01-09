import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RentalDurationDialog from './RentalDurationDialog';

describe('RentalDurationDialog', () => {
    const mockOnClose = vi.fn();
    const mockOnConfirm = vi.fn();
    const mockProduct = { id: 'p1', name: 'PS5', price: 10000 };

    it('renders dialog content when open', () => {
        render(<RentalDurationDialog isOpen={true} onClose={mockOnClose} product={mockProduct} onConfirm={mockOnConfirm} />);
        expect(screen.getByText('Sewa PS5')).toBeInTheDocument();
        // Default duration 1
        expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });

    it('updates duration when preset is clicked', () => {
        render(<RentalDurationDialog isOpen={true} onClose={mockOnClose} product={mockProduct} onConfirm={mockOnConfirm} />);
        const presetBtn = screen.getByText('3 Jam');
        fireEvent.click(presetBtn);
        expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    });

    it('updates calculation when duration input changes', () => {
        render(<RentalDurationDialog isOpen={true} onClose={mockOnClose} product={mockProduct} onConfirm={mockOnConfirm} />);
        const input = screen.getByDisplayValue('1');
        fireEvent.change(input, { target: { value: '2.5' } });

        // 2.5 * 10.000 = 25.000
        // Expect format: Total: Rp 25.000
        expect(screen.getByText((content) => content.includes('Total: Rp 25.000') || content.includes('25.000'))).toBeInTheDocument();
    });

    it('calls onConfirm with correct args', () => {
        render(<RentalDurationDialog isOpen={true} onClose={mockOnClose} product={mockProduct} onConfirm={mockOnConfirm} />);
        const input = screen.getByDisplayValue('1');
        fireEvent.change(input, { target: { value: '4' } });

        const submitBtn = screen.getByText('Masuk Keranjang');
        fireEvent.click(submitBtn);

        expect(mockOnConfirm).toHaveBeenCalledWith(mockProduct, 4);
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('resets duration when component is remounted', () => {
        const { unmount } = render(<RentalDurationDialog isOpen={true} onClose={mockOnClose} product={mockProduct} onConfirm={mockOnConfirm} />);

        // Change to 5
        const input = screen.getByDisplayValue('1');
        fireEvent.change(input, { target: { value: '5' } });
        expect(screen.getByDisplayValue('5')).toBeInTheDocument();

        // Unmount
        unmount();

        // Remount
        render(<RentalDurationDialog isOpen={true} onClose={mockOnClose} product={mockProduct} onConfirm={mockOnConfirm} />);
        expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });
});
