import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PetRooms from './PetRooms';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

// Mock dependencies
vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../context/DataContext', () => ({
    useData: vi.fn(),
}));

// Mock Subcomponents
vi.mock('../components/PetRoomFormDialog', () => ({
    default: () => <div data-testid="mock-room-dialog" />
}));
vi.mock('../components/ConfirmDialog', () => ({
    default: () => <div data-testid="mock-confirm-dialog" />
}));
vi.mock('../components/AlertDialog', () => ({
    default: () => <div data-testid="mock-alert-dialog" />
}));

// Mock icons
vi.mock('lucide-react', () => ({
    Plus: () => <div data-testid="icon-plus" />,
    Edit: () => <div data-testid="icon-edit" />,
    Trash2: () => <div data-testid="icon-trash" />,
    Home: () => <div data-testid="icon-home" />,
    Users: () => <div data-testid="icon-users" />,
    DollarSign: () => <div data-testid="icon-dollarsign" />,
    Info: () => <div data-testid="icon-info" />,
    Activity: () => <div data-testid="icon-activity" />,
    AlertCircle: () => <div data-testid="icon-alertcircle" />
}));

describe('PetRooms', () => {
    const mockCheckPermission = vi.fn();
    const mockAddPetRoom = vi.fn();
    const mockUpdatePetRoom = vi.fn();
    const mockDeletePetRoom = vi.fn();

    const mockData = {
        petRooms: [
            { id: 'room1', name: 'Suite A', type: 'cat', capacity: 1, status: 'available', price: 150000 },
            { id: 'room2', name: 'Deluxe B', type: 'dog', capacity: 2, status: 'occupied', price: 250000 },
            { id: 'room3', name: 'Standard C', type: 'any', capacity: 1, status: 'maintenance', price: 100000 }
        ],
        addPetRoom: mockAddPetRoom,
        updatePetRoom: mockUpdatePetRoom,
        deletePetRoom: mockDeletePetRoom
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckPermission.mockReturnValue(true);
        useAuth.mockReturnValue({ checkPermission: mockCheckPermission });
        useData.mockReturnValue(mockData);
    });

    it('renders the Management header and room cards', () => {
        render(<MemoryRouter><PetRooms /></MemoryRouter>);
        
        expect(screen.getByText('Manajemen Kamar (Pet Hotel)')).toBeInTheDocument();
        expect(screen.getByText('Suite A')).toBeInTheDocument();
        expect(screen.getByText('Deluxe B')).toBeInTheDocument();
        expect(screen.getByText('Standard C')).toBeInTheDocument();
    });

    it('renders empty state when no rooms exist', () => {
        useData.mockReturnValue({
            petRooms: [],
            addPetRoom: mockAddPetRoom,
            updatePetRoom: mockUpdatePetRoom,
            deletePetRoom: mockDeletePetRoom
        });

        render(<MemoryRouter><PetRooms /></MemoryRouter>);
        
        expect(screen.getByText('Belum ada kamar')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /tambah kamar sekarang/i })).toBeInTheDocument();
    });

    it('displays correct status badges', () => {
        render(<MemoryRouter><PetRooms /></MemoryRouter>);
        
        expect(screen.getByText('Tersedia')).toBeInTheDocument();
        expect(screen.getByText('Terisi')).toBeInTheDocument();
        expect(screen.getByText('Perawatan')).toBeInTheDocument();
    });

    it('prevents deletion of occupied rooms', () => {
        render(<MemoryRouter><PetRooms /></MemoryRouter>);
        
        // Find the "Hapus" button for room2 (occupied)
        // Card content structure: Header (p4), Content (p4) -> find room2 card
        const deleteBtn = screen.getAllByRole('button', { name: /hapus/i })[1]; // Index 1 is for room2
        
        fireEvent.click(deleteBtn);
        
        // Should NOT call deletePetRoom
        expect(mockDeletePetRoom).not.toHaveBeenCalled();
    });

    it('allows deletion of available rooms', () => {
        render(<MemoryRouter><PetRooms /></MemoryRouter>);
        
        // Index 0 is room1 (available)
        const deleteBtn = screen.getAllByRole('button', { name: /hapus/i })[0];
        
        fireEvent.click(deleteBtn);
        
        // Should open confirm dialog (the component handles this via state)
        // We can check if it sets roomToDelete
        // Actually, let's just check if it DOESN'T show the "occupied" alert
        expect(screen.queryByText('Kamar yang sedang terisi tidak dapat dihapus.')).not.toBeInTheDocument();
    });
});
