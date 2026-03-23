import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MedicalRecords from './MedicalRecords';
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

// Mock Subcomponents to isolate MedicalRecords
vi.mock('../components/Pagination', () => ({
    default: () => <div data-testid="mock-pagination" />
}));
vi.mock('../components/MedicalRecordFormDialog', () => ({
    default: () => <div data-testid="mock-medical-dialog" />
}));
vi.mock('../components/PetHealthCertificate', () => ({
    default: () => <div data-testid="mock-cert-dialog" />
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
    Search: () => <div data-testid="icon-search" />,
    FileText: () => <div data-testid="icon-file-text" />,
    Calendar: () => <div data-testid="icon-calendar" />,
    User: () => <div data-testid="icon-user" />,
    Stethoscope: () => <div data-testid="icon-stethoscope" />,
    ChevronRight: () => <div data-testid="icon-chevron-right" />,
    Edit: () => <div data-testid="icon-edit" />,
    Edit2: () => <div data-testid="icon-edit-2" />,
    Trash2: () => <div data-testid="icon-trash" />,
    Printer: () => <div data-testid="icon-printer" />,
    ShoppingCart: () => <div data-testid="icon-shopping-cart" />,
    Dog: () => <div data-testid="icon-dog" />
}));

describe('MedicalRecords', () => {
    const mockCheckPermission = vi.fn();
    const mockDeleteMedicalRecord = vi.fn();

    const mockData = {
        medicalRecords: [
            { 
                id: 'rec1', 
                petId: 'pet1', 
                customerId: 'cust1', 
                date: '2023-10-20T10:00:00Z', 
                doctorName: 'Dr. Strange', 
                diagnosis: 'Skin Allergy', 
                treatment: 'Ointment 2x daily',
                services: [{ id: 's1' }],
                prescriptions: [{ id: 'p1' }]
            },
            { 
                id: 'rec2', 
                petId: 'pet2', 
                customerId: 'cust2', 
                date: '2023-10-21T11:00:00Z', 
                doctorName: 'Dr. House', 
                diagnosis: 'Fracture', 
                treatment: 'Rest and Cast',
                services: [],
                prescriptions: []
            }
        ],
        pets: [
            { id: 'pet1', name: 'Fluffy' },
            { id: 'pet2', name: 'Buster' }
        ],
        customers: [
            { id: 'cust1', name: 'Alice' },
            { id: 'cust2', name: 'Bob' }
        ],
        addMedicalRecord: vi.fn(),
        updateMedicalRecord: vi.fn(),
        deleteMedicalRecord: mockDeleteMedicalRecord
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckPermission.mockReturnValue(true);
        useAuth.mockReturnValue({ checkPermission: mockCheckPermission });
        useData.mockReturnValue(mockData);
    });

    it('renders the EMR header and count badge', () => {
        render(<MemoryRouter><MedicalRecords /></MemoryRouter>);
        
        expect(screen.getByText('Rekam Medis Elektronik (EMR)')).toBeInTheDocument();
        expect(screen.getByText('2 Total Records')).toBeInTheDocument();
    });

    it('displays records with correct pet and customer names', () => {
        render(<MemoryRouter><MedicalRecords /></MemoryRouter>);
        
        expect(screen.getAllByText('Fluffy').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Buster').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    });

    it('filters records by search term (pet name)', () => {
        render(<MemoryRouter><MedicalRecords /></MemoryRouter>);
        
        const searchInput = screen.getByPlaceholderText(/Cari hewan/i);
        fireEvent.change(searchInput, { target: { value: 'Fluffy' } });
        
        expect(screen.getAllByText('Fluffy').length).toBeGreaterThan(0);
        expect(screen.queryByText('Buster')).not.toBeInTheDocument();
    });

    it('filters records by search term (diagnosis)', () => {
        render(<MemoryRouter><MedicalRecords /></MemoryRouter>);
        
        const searchInput = screen.getByPlaceholderText(/Cari hewan/i);
        fireEvent.change(searchInput, { target: { value: 'Fracture' } });
        
        expect(screen.getAllByText('Buster').length).toBeGreaterThan(0);
        expect(screen.queryByText('Fluffy')).not.toBeInTheDocument();
    });

    it('navigates to POS with correct recordId when ShoppingCart icon is clicked', () => {
        render(<MemoryRouter><MedicalRecords /></MemoryRouter>);
        
        // Find shopping cart buttons in the table
        const cartButtons = screen.getAllByTestId('icon-shopping-cart');
        
        // Click the first one (for rec1)
        fireEvent.click(cartButtons[0].closest('button'));
        
        expect(mockNavigate).toHaveBeenCalledWith('/pos?recordId=rec1');
    });

    it('displays badges for services and prescriptions', () => {
        render(<MemoryRouter><MedicalRecords /></MemoryRouter>);
        
        // rec1 has 1 service and 1 prescription
        expect(screen.getByText('1 Jasa')).toBeInTheDocument();
        expect(screen.getByText('1 Obat')).toBeInTheDocument();
        
        // rec2 has none
        const dashCells = screen.getAllByText('-');
        expect(dashCells.length).toBeGreaterThan(0);
    });
});
