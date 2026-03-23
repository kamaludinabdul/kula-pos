import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PetProfile from './PetProfile';
import { useData } from '../context/DataContext';

// Mock dependencies
vi.mock('../context/DataContext', () => ({
    useData: vi.fn(),
}));

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ id: 'pet1' }),
    };
});

// Mock Tabs components to simplify testing
vi.mock('../components/ui/tabs', () => {
    return {
        Tabs: ({ children, defaultValue }) => {
            const [active, setActive] = React.useState(defaultValue);
            return <div data-testid="mock-tabs">{React.Children.map(children, child => {
                if (!child) return null;
                return React.cloneElement(child, { active, setActive });
            })}</div>;
        },
        TabsList: ({ children, active, setActive }) => <div>{React.Children.map(children, child => {
            if (!child) return null;
            return React.cloneElement(child, { active, setActive });
        })}</div>,
        TabsTrigger: ({ children, value, active, setActive }) => (
            <button 
                data-testid={`tab-trigger-${value}`} 
                onClick={() => setActive(value)}
                data-state={active === value ? 'active' : 'inactive'}
                role="tab"
            >
                {children}
            </button>
        ),
        TabsContent: ({ children, value, active }) => (
            active === value ? <div data-testid={`tab-content-${value}`}>{children}</div> : null
        )
    };
});

// Mock icons
vi.mock('lucide-react', () => ({
    Dog: () => <div data-testid="icon-dog" />,
    Calendar: () => <div data-testid="icon-calendar" />,
    Stethoscope: () => <div data-testid="icon-stethoscope" />,
    ChevronLeft: () => <div data-testid="icon-chevron-left" />,
    User: () => <div data-testid="icon-user" />,
    Phone: () => <div data-testid="icon-phone" />,
    Weight: () => <div data-testid="icon-weight" />,
    Dna: () => <div data-testid="icon-dna" />,
    CalendarDays: () => <div data-testid="icon-calendar-days" />,
    ArrowUpRight: () => <div data-testid="icon-arrow-up-right" />,
    Clock: () => <div data-testid="icon-clock" />,
    FileText: () => <div data-testid="icon-file-text" />,
    History: () => <div data-testid="icon-history" />,
    Plus: () => <div data-testid="icon-plus" />,
    Activity: () => <div data-testid="icon-activity" />,
    Edit: () => <div data-testid="icon-edit" />,
    ChevronRight: () => <div data-testid="icon-chevron-right" />
}));

describe('PetProfile Page', () => {
    const mockData = {
        pets: [
            { 
                id: 'pet1', 
                name: 'Fluffy', 
                rmNumber: 'RM-001', 
                petType: 'Kucing', 
                breed: 'Persia', 
                weight: 4.5,
                birth_date: '2021-01-01',
                isNeutered: true,
                isVaccinated: true,
                customerId: 'cust1',
                customerName: 'Alice',
                specialNeeds: 'Alergi seafood'
            }
        ],
        customers: [
            { id: 'cust1', name: 'Alice', phone: '08123456789' }
        ],
        medicalRecords: [
            { 
                id: 'rec1', 
                petId: 'pet1', 
                date: '2023-10-20', 
                diagnosis: 'Skin Allergy', 
                treatment: 'Ointment',
                doctorName: 'Dr. Strange',
                prescriptions: [{ product_name: 'Cream A', quantity: 1 }]
            }
        ],
        petBookings: [
            { 
                id: 'book1', 
                petId: 'pet1', 
                startDate: '2023-10-25', 
                serviceType: 'grooming', 
                serviceName: 'Full Grooming',
                status: 'confirmed'
            }
        ],
        petDailyLogs: [
            { 
                id: 'log1', 
                petId: 'pet1', 
                created_at: '2023-10-26T10:00:00Z', 
                staffName: 'Siti',
                eating: 'Lahap',
                mood: 'Ceria',
                bathroom: 'Normal',
                notes: 'Bermain aktif'
            }
        ]
    };

    beforeEach(() => {
        vi.clearAllMocks();
        useData.mockReturnValue(mockData);
    });

    it('renders pet header information', () => {
        render(<MemoryRouter><PetProfile /></MemoryRouter>);
        
        expect(screen.getByText('Fluffy')).toBeInTheDocument();
        expect(screen.getByText(/RM-001/)).toBeInTheDocument();
        expect(screen.getByText(/Kucing/)).toBeInTheDocument();
        expect(screen.getByText(/Persia/)).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('08123456789')).toBeInTheDocument();
    });

    it('renders basic info and special needs', () => {
        render(<MemoryRouter><PetProfile /></MemoryRouter>);
        
        expect(screen.getByText(/01 Jan 2021/)).toBeInTheDocument();
        expect(screen.getByText(/4.5 kg/)).toBeInTheDocument();
        expect(screen.getByText('Sudah')).toBeInTheDocument(); // Vaksin status
        expect(screen.getByText('Alergi seafood')).toBeInTheDocument();
    });

    it('displays medical records in the default tab', () => {
        render(<MemoryRouter><PetProfile /></MemoryRouter>);
        
        expect(screen.getByText('Skin Allergy')).toBeInTheDocument();
        expect(screen.getByText('Ointment')).toBeInTheDocument();
        expect(screen.getByText(/Cream A/)).toBeInTheDocument();
        expect(screen.getByText(/Dr\. Strange/)).toBeInTheDocument();
    });

    it('switches to visitation history tab', async () => {
        render(<MemoryRouter><PetProfile /></MemoryRouter>);
        
        const historyTab = screen.getByTestId('tab-trigger-history');
        fireEvent.click(historyTab);
        
        await waitFor(() => {
            expect(screen.getByText(/25/)).toBeInTheDocument();
            expect(screen.getByText(/Okt/i)).toBeInTheDocument();
            expect(screen.getByText('Full Grooming')).toBeInTheDocument();
            expect(screen.getByText('confirmed')).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('switches to daily logs tab', async () => {
        render(<MemoryRouter><PetProfile /></MemoryRouter>);
        
        const dailyTab = screen.getByTestId('tab-trigger-daily');
        fireEvent.click(dailyTab);
        
        await waitFor(() => {
            expect(screen.getByText('Lahap')).toBeInTheDocument();
            expect(screen.getByText('Ceria')).toBeInTheDocument();
            expect(screen.getByText('Normal')).toBeInTheDocument();
            expect(screen.getByText(/"Bermain aktif"/)).toBeInTheDocument();
        }, { timeout: 2000 });
    });

    it('renders "Hewan tidak ditemukan" when pet id is invalid', () => {
        useData.mockReturnValue({ ...mockData, pets: [] });
        render(<MemoryRouter><PetProfile /></MemoryRouter>);
        
        expect(screen.getByText('Hewan tidak ditemukan')).toBeInTheDocument();
        
        const backButton = screen.getByText('Kembali ke Daftar');
        fireEvent.click(backButton);
        expect(mockNavigate).toHaveBeenCalledWith('/pets');
    });

    it('navigates to create medical record or booking when buttons are clicked', () => {
        render(<MemoryRouter><PetProfile /></MemoryRouter>);
        
        const medicalButton = screen.getByText('Buat Rekam Medis');
        fireEvent.click(medicalButton);
        expect(mockNavigate).toHaveBeenCalledWith('/medical-records');
        
        const bookingButton = screen.getByText('Atur Booking');
        fireEvent.click(bookingButton);
        expect(mockNavigate).toHaveBeenCalledWith('/pet-bookings');
    });
});
