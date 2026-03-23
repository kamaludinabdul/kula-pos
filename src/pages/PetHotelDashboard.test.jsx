import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PetHotelDashboard from './PetHotelDashboard';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { MemoryRouter } from 'react-router-dom';

// Mock contexts
vi.mock('../context/DataContext', () => ({
    useData: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

vi.mock('../context/ShiftContext', () => ({
    useShift: vi.fn(),
}));

// Mock icons
vi.mock('lucide-react', () => ({
    Home: () => <div data-testid="icon-home" />,
    Settings: () => <div data-testid="icon-settings" />,
    CheckCircle: () => <div data-testid="icon-check" />,
    Bed: () => <div data-testid="icon-bed" />,
    LogIn: () => <div data-testid="icon-login" />,
    LogOut: () => <div data-testid="icon-logout" />,
    Coffee: () => <div data-testid="icon-coffee" />,
    Edit2: () => <div data-testid="icon-edit" />,
    Heart: () => <div data-testid="icon-heart" />,
    Link: () => <div data-testid="icon-link" />,
    LinkIcon: () => <div data-testid="icon-link" />,
    Plus: () => <div data-testid="icon-plus" />,
    X: () => <div data-testid="icon-x" />,
    Printer: () => <div data-testid="icon-printer" />,
    Banknote: () => <div data-testid="icon-banknote" />,
    CreditCard: () => <div data-testid="icon-creditcard" />,
    Trash2: () => <div data-testid="icon-trash" />,
    XCircle: () => <div data-testid="icon-xcircle" />,
    FileText: () => <div data-testid="icon-filetext" />,
    Wallet: () => <div data-testid="icon-wallet" />
}));

// Mock Radix/UI components to render inline
vi.mock('../components/ui/dialog', () => ({
    Dialog: ({ children, open }) => open ? <div data-testid="active-dialog">{children}</div> : null,
    DialogContent: ({ children }) => <div data-testid="dialog-content">{children}</div>,
    DialogHeader: ({ children }) => <div>{children}</div>,
    DialogTitle: ({ children }) => <div>{children}</div>,
    DialogFooter: ({ children }) => <div>{children}</div>,
    DialogTrigger: ({ children }) => <div>{children}</div>,
    DialogClose: ({ children }) => <div>{children}</div>,
    DialogDescription: ({ children }) => <div>{children}</div>
}));

vi.mock('../components/ui/alert-dialog', () => ({
    AlertDialog: ({ children, open }) => open ? <div data-testid="active-alert-dialog">{children}</div> : null,
    AlertDialogContent: ({ children }) => <div>{children}</div>,
    AlertDialogHeader: ({ children }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }) => <div>{children}</div>,
    AlertDialogDescription: ({ children }) => <div>{children}</div>,
    AlertDialogFooter: ({ children }) => <div>{children}</div>,
    AlertDialogAction: ({ children }) => <div>{children}</div>,
    AlertDialogCancel: ({ children }) => <div>{children}</div>
}));

vi.mock('../components/ui/select', () => ({
    Select: ({ children }) => <div data-testid="mock-select">{children}</div>,
    SelectTrigger: ({ children }) => <button data-testid="mock-select-trigger">{children}</button>,
    SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
    SelectContent: ({ children }) => <div data-testid="mock-select-content">{children}</div>,
    SelectItem: ({ children, value }) => <div data-testid={`mock-select-item-${value}`}>{children}</div>
}));

vi.mock('../components/ui/SearchableSelect', () => ({
    SearchableSelect: ({ placeholder, value, options }) => (
        <div data-testid="mock-searchable-select">
            <span>{placeholder}</span>
            <span>Selected: {value}</span>
            <div data-testid="mock-options">
                {options?.map(o => <div key={o.value}>{o.label}</div>)}
            </div>
        </div>
    )
}));

describe('PetHotelDashboard Page', () => {
    let mockData;
    const mockCheckPermission = vi.fn().mockReturnValue(true);

    beforeEach(() => {
        vi.clearAllMocks();
        
        mockData = {
            petRooms: [
                { id: 'room1', name: 'Deluxe 01', status: 'occupied', currentBookingId: 'book1', linkedServiceId: 'p1' },
                { id: 'room2', name: 'Standard 02', status: 'available', linkedServiceId: 'p2' }
            ],
            petBookings: [
                { 
                    id: 'book1', 
                    petId: 'pet1', 
                    roomId: 'room1', 
                    startDate: new Date(Date.now() - 86400000).toISOString(),
                    endDate: new Date(Date.now() + 86400000).toISOString(),
                    status: 'occupied',
                    totalPrice: 300000,
                    notes: 'Loves catnip',
                    extraItems: [
                        { name: 'Grooming', price: 50000, qty: 1 }
                    ]
                }
            ],
            pets: [
                { id: 'pet1', name: 'Fluffy', petType: 'Cat', customerId: 'c1' }
            ],
            products: [
                { id: 'p1', name: 'Deluxe 01', price: 150000, category: 'hotel', pricingType: 'daily' },
                { id: 'p2', name: 'Standard 02', price: 75000, category: 'hotel', pricingType: 'daily' },
                { id: 'p3', name: 'Whiskas', price: 10000, category: 'food' }
            ],
            petServices: [],
            customers: [
                { id: 'c1', name: 'Owner Name' }
            ],
            stores: [{ id: 's1', name: 'Pet Clinic' }],
            activeStoreId: 's1',
            fetchAllProducts: vi.fn(),
            fetchPetServices: vi.fn(),
            addPetBooking: vi.fn(),
            updatePetBooking: vi.fn(),
            processSale: vi.fn().mockResolvedValue({ success: true, id: 'sale1' })
        };

        useData.mockReturnValue(mockData);
        useAuth.mockReturnValue({
            user: { role: 'admin' },
            checkPermission: mockCheckPermission
        });
        useShift.mockReturnValue({
            currentShift: { id: 'shift1' }
        });
    });

    it('renders hotel statistics and room list', () => {
        render(<MemoryRouter><PetHotelDashboard /></MemoryRouter>);
        
        expect(screen.getByText(/Hotel Hewan/i)).toBeInTheDocument();
        expect(screen.getByText(/Total Kamar/i)).toBeInTheDocument();
        
        expect(screen.getByText('Deluxe 01')).toBeInTheDocument();
        expect(screen.getByText('Standard 02')).toBeInTheDocument();
    });

    it('displays occupied room with check-out button', () => {
        render(<MemoryRouter><PetHotelDashboard /></MemoryRouter>);
        
        expect(screen.getAllByRole('button', { name: /Check-out/i }).length).toBeGreaterThan(0);
    });

    it('opens check-in modal when "Check-in" is clicked', async () => {
        render(<MemoryRouter><PetHotelDashboard /></MemoryRouter>);
        
        const checkinButton = screen.getByRole('button', { name: 'Check-in' });
        console.log('BUTTON FOUND:', checkinButton.outerHTML);
        fireEvent.click(checkinButton);
        
        console.log('POST-CLICK DOM:', screen.queryAllByTestId('active-dialog').length);
        
        await waitFor(() => {
            const dialogs = screen.queryAllByTestId('active-dialog');
            if (dialogs.length === 0) {
                // Log the whole DOM if it's still not opening
                // console.log(document.body.innerHTML);
            }
            expect(dialogs.length).toBeGreaterThan(0);
        }, { timeout: 2000 });
        
        const dialog = screen.getAllByTestId('active-dialog')[0];
        expect(within(dialog).getByText(/Check-in Kamar/i)).toBeInTheDocument();
    });

    it('opens checkout dialog when Check-out is clicked', async () => {
        render(<MemoryRouter><PetHotelDashboard /></MemoryRouter>);
        
        const checkoutButton = screen.getAllByRole('button', { name: 'Check-out' })[0];
        fireEvent.click(checkoutButton);
        
        await waitFor(() => {
            expect(screen.getAllByTestId('active-dialog').length).toBeGreaterThan(0);
        });
        const dialog = screen.getAllByTestId('active-dialog')[0];
        expect(within(dialog).getByText(/Check-out & Bayar/i)).toBeInTheDocument();
        expect(within(dialog).getByText(/Deluxe 01/i)).toBeInTheDocument();
    });

    it('opens add-on dialog when "+ Menu" is clicked', async () => {
        render(<MemoryRouter><PetHotelDashboard /></MemoryRouter>);
        
        const addonButton = screen.getAllByRole('button', { name: '+ Menu' })[0];
        fireEvent.click(addonButton);
        
        await waitFor(() => {
            expect(screen.getAllByTestId('active-dialog').length).toBeGreaterThan(0);
        });
        const dialog = screen.getAllByTestId('active-dialog')[0];
        expect(within(dialog).getByText(/Tambah Menu \/ Add-on/i)).toBeInTheDocument();
    });

    it('allows closing add-on dialog', async () => {
        render(<MemoryRouter><PetHotelDashboard /></MemoryRouter>);
        
        const addonButton = screen.getAllByRole('button', { name: '+ Menu' })[0];
        fireEvent.click(addonButton);
        
        await waitFor(() => {
            expect(screen.getAllByTestId('active-dialog').length).toBeGreaterThan(0);
        });
        const dialog = screen.getAllByTestId('active-dialog')[0];
        const closeButton = within(dialog).getByRole('button', { name: /Tutup/i });
        fireEvent.click(closeButton);
        
        await waitFor(() => {
            expect(screen.queryByTestId('active-dialog')).not.toBeInTheDocument();
        });
    });

    it('calculates totals in checkout dialog', async () => {
        render(<MemoryRouter><PetHotelDashboard /></MemoryRouter>);
        
        const checkoutButton = screen.getAllByRole('button', { name: 'Check-out' })[0];
        fireEvent.click(checkoutButton);
        
        await waitFor(() => {
            expect(screen.getAllByTestId('active-dialog').length).toBeGreaterThan(0);
        });
        const dialog = screen.getAllByTestId('active-dialog')[0];
        expect(within(dialog).getByText(/Total Tagihan:/i)).toBeInTheDocument();
    });
});
