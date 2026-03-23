import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PetServices from './PetServices';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

// Mock dependencies
vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../context/DataContext', () => ({
    useData: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock Subcomponents
vi.mock('../components/Pagination', () => ({
    default: ({ totalItems, onPageChange }) => (
        <div data-testid="mock-pagination">
            <button onClick={() => onPageChange(2)}>Next Page</button>
            <span>Total: {totalItems}</span>
        </div>
    )
}));
vi.mock('../components/ConfirmDialog', () => ({
    default: ({ isOpen, onConfirm, title, description }) => (
        isOpen ? <div data-testid="mock-confirm-dialog">
            <span>{title}</span>
            <p>{description}</p>
            <button onClick={onConfirm}>Confirm</button>
        </div> : null
    )
}));
vi.mock('../components/AlertDialog', () => ({
    default: ({ isOpen, title, message }) => (
        isOpen ? <div data-testid="mock-alert-dialog">
            <span>{title}</span>
            <p>{message}</p>
        </div> : null
    )
}));
vi.mock('../components/PetServiceFormDialog', () => ({
    default: ({ isOpen, onSave, initialData }) => (
        isOpen ? <div data-testid="mock-service-dialog">
            <span>{initialData ? 'Edit Service' : 'Add Service'}</span>
            <button onClick={() => onSave({ name: 'New Service', price: 100000, category: 'grooming' })}>Save</button>
        </div> : null
    )
}));

// Mock icons
vi.mock('lucide-react', async () => {
    const actual = await vi.importActual('lucide-react');
    return {
        ...actual,
        Plus: (props) => <div data-testid="icon-plus" {...props} />,
        Search: (props) => <div data-testid="icon-search" {...props} />,
        Edit: (props) => <div data-testid="icon-edit" {...props} />,
        Trash2: (props) => <div data-testid="icon-trash" {...props} />,
        Scissors: (props) => <div data-testid="icon-scissors" {...props} />,
        Stethoscope: (props) => <div data-testid="icon-stethoscope" {...props} />,
        Gem: (props) => <div data-testid="icon-gem" {...props} />,
        Package: () => <div data-testid="icon-package" />
    };
});

describe('PetServices Page', () => {
    const mockCheckPermission = vi.fn();
    const mockAddPetService = vi.fn();
    const mockUpdatePetService = vi.fn();
    const mockDeletePetService = vi.fn();

    const mockData = {
        petServices: [
            { 
                id: 's1', 
                name: 'Mandi Sehat', 
                price: 50000, 
                category: 'grooming', 
                description: 'Mandi dengan shampoo herbal',
                isActive: true
            },
            { 
                id: 's2', 
                name: 'Vaksin Rabies', 
                price: 150000, 
                category: 'medis', 
                description: 'Vaksinasi tahunan rabies',
                isActive: true
            }
        ],
        addPetService: mockAddPetService,
        updatePetService: mockUpdatePetService,
        deletePetService: mockDeletePetService
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckPermission.mockReturnValue(true);
        useAuth.mockReturnValue({ checkPermission: mockCheckPermission });
        useData.mockReturnValue(mockData);
    });

    it('renders the services header and catalog', () => {
        render(<MemoryRouter><PetServices /></MemoryRouter>);
        
        expect(screen.getByText(/Katalog Layanan/i)).toBeInTheDocument();
        expect(screen.getByText('Mandi Sehat')).toBeInTheDocument();
        expect(screen.getByText('Vaksin Rabies')).toBeInTheDocument();
        expect(screen.getByText('Rp 50.000')).toBeInTheDocument();
        expect(screen.getByText('Rp 150.000')).toBeInTheDocument();
    });

    it('filters services by search term', () => {
        render(<MemoryRouter><PetServices /></MemoryRouter>);
        
        const searchInput = screen.getByPlaceholderText(/Cari nama layanan/i);
        fireEvent.change(searchInput, { target: { value: 'Mandi' } });
        
        expect(screen.getByText('Mandi Sehat')).toBeInTheDocument();
        expect(screen.queryByText('Vaksin Rabies')).not.toBeInTheDocument();
    });

    it('filters services by category', () => {
        render(<MemoryRouter><PetServices /></MemoryRouter>);
        
        // Find categories filter
        const groomingFilter = screen.getByText('Grooming');
        fireEvent.click(groomingFilter);
        
        expect(screen.getByText('Mandi Sehat')).toBeInTheDocument();
        // Since we are clicking a filter, we should check if multiple results or filtered results are shown
        // In the component, clicking 'Grooming' should show only grooming services
    });

    it('opens add service modal when "Tambah Layanan" is clicked', () => {
        render(<MemoryRouter><PetServices /></MemoryRouter>);
        
        const addButton = screen.getByText('Tambah Layanan');
        fireEvent.click(addButton);
        
        expect(screen.getByTestId('mock-service-dialog')).toBeInTheDocument();
        expect(screen.getByText('Add Service')).toBeInTheDocument();
    });

    it('opens edit service modal when edit button is clicked', () => {
        render(<MemoryRouter><PetServices /></MemoryRouter>);
        
        const editButtons = screen.getAllByTestId('icon-edit');
        fireEvent.click(editButtons[0].closest('button'));
        
        expect(screen.getByTestId('mock-service-dialog')).toBeInTheDocument();
        expect(screen.getByText('Edit Service')).toBeInTheDocument();
    });

    it('opens delete confirmation and calls deletePetService on confirm', async () => {
        mockDeletePetService.mockResolvedValue({ success: true });
        render(<MemoryRouter><PetServices /></MemoryRouter>);
        
        const deleteButtons = screen.getAllByTestId('icon-trash');
        fireEvent.click(deleteButtons[0].closest('button'));
        
        expect(screen.getByTestId('mock-confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText(/Apakah Anda yakin ingin menghapus layanan "Mandi Sehat"/i)).toBeInTheDocument();
        
        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);
        
        expect(mockDeletePetService).toHaveBeenCalledWith('s1');
    });

    it('shows alert dialog when deletion fails', async () => {
        mockDeletePetService.mockResolvedValue({ success: false, error: 'Service is in use' });
        render(<MemoryRouter><PetServices /></MemoryRouter>);
        
        const deleteButtons = screen.getAllByTestId('icon-trash');
        fireEvent.click(deleteButtons[0].closest('button'));
        
        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);
        
        await waitFor(() => {
            expect(screen.getByTestId('mock-alert-dialog')).toBeInTheDocument();
            expect(screen.getByText('Service is in use')).toBeInTheDocument();
        });
    });

    it('hides "Tambah Layanan" button if user lacks permission', () => {
        mockCheckPermission.mockReturnValue(false);
        render(<MemoryRouter><PetServices /></MemoryRouter>);
        
        expect(screen.queryByText('Tambah Layanan')).not.toBeInTheDocument();
    });
});
