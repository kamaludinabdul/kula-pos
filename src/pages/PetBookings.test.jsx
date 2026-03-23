import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PetBookings from './PetBookings';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

// Mock dependencies
vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../context/DataContext', () => ({
    useData: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => vi.fn(),
    };
});

// Mock Subcomponents
vi.mock('../components/Pagination', () => ({
    default: () => <div data-testid="mock-pagination" />
}));
vi.mock('../components/PetBookingFormDialog', () => ({
    default: () => <div data-testid="mock-booking-dialog" />
}));
vi.mock('../components/MedicalRecordFormDialog', () => ({
    default: () => <div data-testid="mock-medical-dialog" />
}));
vi.mock('../components/PetDailyLogModal', () => ({
    default: () => <div data-testid="mock-daily-log-modal" />
}));
vi.mock('../components/ConfirmDialog', () => ({
    default: () => <div data-testid="mock-confirm-dialog" />
}));
vi.mock('../components/AlertDialog', () => ({
    default: () => <div data-testid="mock-alert-dialog" />
}));
vi.mock('../components/BookingPaymentDialog', () => ({
    default: () => <div data-testid="mock-payment-dialog" />
}));

// Mock icons to simplify DOM
vi.mock('lucide-react', () => ({
    Plus: () => <div data-testid="icon-plus" />,
    Search: () => <div data-testid="icon-search" />,
    Edit: () => <div data-testid="icon-edit" />,
    Trash2: () => <div data-testid="icon-trash" />,
    Calendar: () => <div data-testid="icon-calendar" />,
    Clock: () => <div data-testid="icon-clock" />,
    Scissors: () => <div data-testid="icon-scissors" />,
    Home: () => <div data-testid="icon-home" />,
    Stethoscope: () => <div data-testid="icon-stethoscope" />,
    ChevronRight: () => <div data-testid="icon-chevron-right" />,
    Heart: () => <div data-testid="icon-heart" />,
    ShoppingCart: () => <div data-testid="icon-shopping-cart" />,
    Banknote: () => <div data-testid="icon-banknote" />,
    XCircle: () => <div data-testid="icon-x-circle" />,
    FileText: () => <div data-testid="icon-file-text" />
}));

describe('PetBookings', () => {
    const mockCheckPermission = vi.fn();
    const mockAddPetBooking = vi.fn();
    const mockUpdatePetBooking = vi.fn();
    const mockDeletePetBooking = vi.fn();

    const mockData = {
        petBookings: [
            { id: 1, petId: 101, customerId: 201, serviceType: 'grooming', status: 'pending', startDate: '2023-10-25', startTime: '10:00', totalPrice: 150000, notes: 'Needs extra care' },
            { id: 2, petId: 102, customerId: 202, serviceType: 'medical', status: 'confirmed', startDate: '2023-10-26', startTime: '13:00', totalPrice: 200000, notes: 'Vaccine target' },
            { id: 3, petId: 103, customerId: 201, serviceType: 'hotel', status: 'completed', startDate: '2023-10-20', endDate: '2023-10-22', totalPrice: 300000, notes: 'Stayed 2 nights' }
        ],
        pets: [
            { id: 101, name: 'Buddy' },
            { id: 102, name: 'Luna' },
            { id: 103, name: 'Max' }
        ],
        customers: [
            { id: 201, name: 'John Doe', phone: '08123' },
            { id: 202, name: 'Jane Smith', phone: '08456' }
        ],
        petRooms: [
            { id: 1, name: 'Standard Room A' }
        ],
        petServices: [
            { id: 1, name: 'Basic Grooming' },
            { id: 2, name: 'General Checkup' }
        ],
        addPetBooking: mockAddPetBooking,
        updatePetBooking: mockUpdatePetBooking,
        deletePetBooking: mockDeletePetBooking
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckPermission.mockReturnValue(true); // Allow all by default in tests
        useAuth.mockReturnValue({ checkPermission: mockCheckPermission });
        useData.mockReturnValue(mockData);
    });

    it('renders the Booking Management header and add button', () => {
        render(<MemoryRouter><PetBookings /></MemoryRouter>);
        
        expect(screen.getByText('Booking Management')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /buat booking/i })).toBeInTheDocument();
    });

    it('displays the correct number of bookings from context', () => {
        render(<MemoryRouter><PetBookings /></MemoryRouter>);
        
        // Check for pet names showing up in the table
        expect(screen.getByText('Buddy')).toBeInTheDocument();
        expect(screen.getByText('Luna')).toBeInTheDocument();
        expect(screen.getByText('Max')).toBeInTheDocument();
    });

    it('filters bookings based on search term', () => {
        render(<MemoryRouter><PetBookings /></MemoryRouter>);
        
        const searchInput = screen.getByPlaceholderText('Cari hewan, pemilik...');
        fireEvent.change(searchInput, { target: { value: 'Luna' } });
        
        expect(screen.getByText('Luna')).toBeInTheDocument();
        expect(screen.queryByText('Buddy')).not.toBeInTheDocument();
        expect(screen.queryByText('Max')).not.toBeInTheDocument();
        
        // Search by customer name
        fireEvent.change(searchInput, { target: { value: 'John' } });
        expect(screen.getByText('Buddy')).toBeInTheDocument();
        expect(screen.getByText('Max')).toBeInTheDocument();
        expect(screen.queryByText('Luna')).not.toBeInTheDocument();
    });

    it('filters bookings based on status tabs', () => {
        render(<MemoryRouter><PetBookings /></MemoryRouter>);
        
        // Click 'Menunggu' status
        fireEvent.click(screen.getByText('Menunggu', { selector: 'button' }));
        expect(screen.getByText('Buddy')).toBeInTheDocument();
        expect(screen.queryByText('Luna')).not.toBeInTheDocument();
        
        // Click 'Dikonfirmasi' status
        fireEvent.click(screen.getByText('Dikonfirmasi', { selector: 'button' }));
        expect(screen.getByText('Luna')).toBeInTheDocument();
        expect(screen.queryByText('Buddy')).not.toBeInTheDocument();
    });
    
    it('shows action buttons appropriately based on status', async () => {
        mockUpdatePetBooking.mockResolvedValue({ success: true });
        
        render(<MemoryRouter><PetBookings /></MemoryRouter>);
        
        // For 'pending', we should see "Konfirmasi"
        const confirmBtn = screen.getByRole('button', { name: /^konfirmasi$/i });
        expect(confirmBtn).toBeInTheDocument();
        
        // Test status change function call
        fireEvent.click(confirmBtn);
        
        // Wait for state updates/promises to resolve
        await vi.waitFor(() => {
            expect(mockUpdatePetBooking).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'confirmed' }));
        });
    });
});
