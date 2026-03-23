import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PetDashboard from './PetDashboard';
import { useData } from '../context/DataContext';

// Mock dependencies
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

// Mock CalendarView
vi.mock('../components/CalendarView', () => ({
    default: () => <div data-testid="mock-calendar">Calendar View</div>
}));

// Mock icons
vi.mock('lucide-react', () => ({
    Calendar: () => <div data-testid="icon-calendar" />,
    Users: () => <div data-testid="icon-users" />,
    Activity: () => <div data-testid="icon-activity" />,
    Plus: () => <div data-testid="icon-plus" />,
    FileText: () => <div data-testid="icon-filetext" />,
    ClipboardList: () => <div data-testid="icon-clipboard" />,
    Briefcase: () => <div data-testid="icon-briefcase" />,
    Scissors: () => <div data-testid="icon-scissors" />,
    Stethoscope: () => <div data-testid="icon-stethoscope" />,
    AlertCircle: () => <div data-testid="icon-alert" />,
    Syringe: () => <div data-testid="icon-syringe" />,
    Hotel: () => <div data-testid="icon-hotel" />,
    ArrowRight: () => <div data-testid="icon-arrow" />
}));

describe('PetDashboard Page', () => {
    const mockData = {
        pets: [
            { id: '1', name: 'Fluffy' },
            { id: '2', name: 'Buster' }
        ],
        petBookings: [
            { id: 'b1', petId: '1', startDate: new Date().toISOString(), status: 'confirmed', serviceType: 'hotel' },
            { id: 'b2', petId: '2', startDate: new Date().toISOString(), status: 'confirmed', serviceType: 'grooming' }
        ],
        petRooms: [
            { id: 'r1', status: 'available' },
            { id: 'r2', status: 'occupied' }
        ],
        medicalRecords: [
            { id: 'm1', petId: '1', date: new Date().toISOString(), diagnosis: 'Healthy', doctorName: 'Dr. Jane' },
            { id: 'm2', petId: '2', date: new Date().toISOString(), diagnosis: 'Checkup', doctorName: 'Dr. John' }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        useData.mockReturnValue(mockData);
    });

    it('renders dashboard header and quick actions', () => {
        render(<MemoryRouter><PetDashboard /></MemoryRouter>);
        
        expect(screen.getByText('Pet Care Dashboard')).toBeInTheDocument();
        // There are multiple "Booking Baru" (header and action)
        expect(screen.getAllByText(/Booking Baru/i).length).toBeGreaterThan(1);
        expect(screen.getByText(/Tambah Hewan/i)).toBeInTheDocument();
    });

    it('displays correct statistics values', () => {
        render(<MemoryRouter><PetDashboard /></MemoryRouter>);
        
        // Check for card titles
        expect(screen.getByText(/Total Hewan/i)).toBeInTheDocument();
        expect(screen.getByText(/Booking Hari Ini/i)).toBeInTheDocument();
        expect(screen.getByText(/Kunjungan Hari Ini/i)).toBeInTheDocument();
        expect(screen.getByText(/Tamu Menginap/i)).toBeInTheDocument();
        expect(screen.getByText(/Kamar Kosong/i)).toBeInTheDocument();
    });

    it('navigates to correct paths on quick action click', () => {
        render(<MemoryRouter><PetDashboard /></MemoryRouter>);
        
        const addPetAction = screen.getByText(/Tambah Hewan/i).closest('button');
        fireEvent.click(addPetAction);
        expect(mockNavigate).toHaveBeenCalledWith('/pets');
        
        const bookingAction = screen.getAllByText(/Booking Baru/i).find(el => el.closest('button')).closest('button');
        fireEvent.click(bookingAction);
        expect(mockNavigate).toHaveBeenCalledWith('/pet-bookings');
    });
});
