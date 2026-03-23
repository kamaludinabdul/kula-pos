import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Pets from './Pets';
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
vi.mock('../components/PetFormDialog', () => ({
    default: ({ isOpen, onSave, initialData }) => (
        isOpen ? <div data-testid="mock-pet-dialog">
            <span>{initialData ? 'Edit Pet' : 'Add Pet'}</span>
            <button onClick={() => onSave({ name: 'New Pet' })}>Save</button>
        </div> : null
    )
}));

// Mock icons
vi.mock('lucide-react', () => ({
    Plus: () => <div data-testid="icon-plus" />,
    Search: () => <div data-testid="icon-search" />,
    Edit: () => <div data-testid="icon-edit" />,
    Trash2: () => <div data-testid="icon-trash" />,
    User: () => <div data-testid="icon-user" />,
    Phone: () => <div data-testid="icon-phone" />,
    Info: () => <div data-testid="icon-info" />
}));

describe('Pets Page', () => {
    const mockCheckPermission = vi.fn();
    const mockAddPet = vi.fn();
    const mockUpdatePet = vi.fn();
    const mockDeletePet = vi.fn();

    const mockData = {
        pets: [
            { 
                id: 'pet1', 
                name: 'Fluffy', 
                rmNumber: 'RM-001', 
                petType: 'Kucing', 
                breed: 'Persia', 
                gender: 'Betina', 
                petAge: '2 Tahun',
                isNeutered: true,
                isVaccinated: true,
                customerId: 'cust1',
                specialNeeds: 'Alergi seafood'
            },
            { 
                id: 'pet2', 
                name: 'Buster', 
                rmNumber: 'RM-002', 
                petType: 'Anjing', 
                breed: 'Golden', 
                gender: 'Jantan', 
                petAge: '1 Tahun',
                isNeutered: false,
                isVaccinated: false,
                customerId: 'cust2'
            }
        ],
        customers: [
            { id: 'cust1', name: 'Alice' },
            { id: 'cust2', name: 'Bob' }
        ],
        addPet: mockAddPet,
        updatePet: mockUpdatePet,
        deletePet: mockDeletePet
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckPermission.mockReturnValue(true);
        useAuth.mockReturnValue({ checkPermission: mockCheckPermission });
        useData.mockReturnValue(mockData);
    });

    it('renders the page header and pet list', () => {
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        expect(screen.getByText('Data Hewan (Pet Registry)')).toBeInTheDocument();
        expect(screen.getAllByText('Fluffy').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Buster').length).toBeGreaterThan(0);
        expect(screen.getAllByText('RM-001').length).toBeGreaterThan(0);
        expect(screen.getAllByText('RM-002').length).toBeGreaterThan(0);
    });

    it('displays correct biological data and owner names', () => {
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        expect(screen.getAllByText('Kucing').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Persia').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    });

    it('shows vaccination and neuter status correctly', () => {
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        // Fluffy is neutered and vaccinated
        expect(screen.getAllByText('Ya').length).toBeGreaterThan(0); // Steril
        expect(screen.getAllByText('Lengkap').length).toBeGreaterThan(0); // Vaksin
        
        // Buster is not
        expect(screen.getAllByText('Tidak').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Belum').length).toBeGreaterThan(0);
    });

    it('filters pets by name', () => {
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        const searchInput = screen.getByPlaceholderText(/Cari nama hewan/i);
        fireEvent.change(searchInput, { target: { value: 'Fluffy' } });
        
        expect(screen.getAllByText('Fluffy').length).toBeGreaterThan(0);
        expect(screen.queryByText('Buster')).not.toBeInTheDocument();
    });

    it('filters pets by owner name', () => {
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        const searchInput = screen.getByPlaceholderText(/Cari nama hewan/i);
        fireEvent.change(searchInput, { target: { value: 'Bob' } });
        
        expect(screen.getAllByText('Buster').length).toBeGreaterThan(0);
        expect(screen.queryByText('Fluffy')).not.toBeInTheDocument();
    });

    it('filters pets by RM number', () => {
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        const searchInput = screen.getByPlaceholderText(/Cari nama hewan/i);
        fireEvent.change(searchInput, { target: { value: 'RM-001' } });
        
        expect(screen.getAllByText('Fluffy').length).toBeGreaterThan(0);
        expect(screen.queryByText('Buster')).not.toBeInTheDocument();
    });

    it('opens add pet modal when "Tambah Pet Baru" is clicked', () => {
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        const addButton = screen.getByText('Tambah Pet Baru');
        fireEvent.click(addButton);
        
        expect(screen.getByTestId('mock-pet-dialog')).toBeInTheDocument();
        expect(screen.getByText('Add Pet')).toBeInTheDocument();
    });

    it('opens edit pet modal when edit button is clicked', () => {
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        const editButtons = screen.getAllByTestId('icon-edit');
        fireEvent.click(editButtons[0].closest('button'));
        
        expect(screen.getByTestId('mock-pet-dialog')).toBeInTheDocument();
        expect(screen.getByText('Edit Pet')).toBeInTheDocument();
    });

    it('opens delete confirmation and calls deletePet on confirm', async () => {
        mockDeletePet.mockResolvedValue({ success: true });
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        const deleteButtons = screen.getAllByTestId('icon-trash');
        fireEvent.click(deleteButtons[0].closest('button'));
        
        expect(screen.getByTestId('mock-confirm-dialog')).toBeInTheDocument();
        expect(screen.getByText(/Apakah Anda yakin ingin menghapus data hewan "Fluffy"/i)).toBeInTheDocument();
        
        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);
        
        expect(mockDeletePet).toHaveBeenCalledWith('pet1');
    });

    it('shows alert dialog when deletion fails', async () => {
        mockDeletePet.mockResolvedValue({ success: false, error: 'Cannot delete pet with medical records' });
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        const deleteButtons = screen.getAllByTestId('icon-trash');
        fireEvent.click(deleteButtons[0].closest('button'));
        
        const confirmButton = screen.getByText('Confirm');
        fireEvent.click(confirmButton);
        
        await waitFor(() => {
            expect(screen.getByTestId('mock-alert-dialog')).toBeInTheDocument();
            expect(screen.getByText('Cannot delete pet with medical records')).toBeInTheDocument();
        });
    });

    it('navigates to pet profile when pet name is clicked', () => {
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        const flufyLink = screen.getAllByText('Fluffy')[0]; // One in table, one in hidden mobile view
        // In the desktop table, it's a Link
        expect(flufyLink.closest('a')).toHaveAttribute('href', '/pet-profile/pet1');
    });

    it('hides "Tambah Pet Baru" button if user lacks permission', () => {
        mockCheckPermission.mockReturnValue(false);
        render(<MemoryRouter><Pets /></MemoryRouter>);
        
        expect(screen.queryByText('Tambah Pet Baru')).not.toBeInTheDocument();
    });
});
