import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SecuritySettings from './SecuritySettings';

// Mock Supabase
const { mockFrom, mockUpdate, mockEq } = vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockUpdate: vi.fn(),
    mockEq: vi.fn().mockResolvedValue({ error: null })
}));

mockFrom.mockReturnValue({ update: mockUpdate });
mockUpdate.mockReturnValue({ eq: mockEq });

vi.mock('../../supabase', () => ({
    supabase: {
        from: mockFrom
    }
}));

// Mock useData
const mockCurrentStore = {
    id: 'store123',
    settings: {
        autoLockEnabled: false,
        autoLockDuration: 30
    }
};

vi.mock('../../context/DataContext', () => ({
    useData: () => ({
        currentStore: mockCurrentStore
    })
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock('../../components/ui/use-toast', () => ({
    useToast: () => ({ toast: mockToast })
}));

describe('SecuritySettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset store mock if needed or just rely on re-render.
        // If we mutate mockCurrentStore, be careful.
    });

    it('renders and loads initial settings', () => {
        render(<SecuritySettings />);

        expect(screen.getByText('Keamanan & Layar Kunci')).toBeInTheDocument();
        // Switch should be off
        const switchBtn = screen.getByRole('switch');
        expect(switchBtn).toHaveAttribute('aria-checked', 'false');
    });

    it('enables auto lock and shows duration input', async () => {
        render(<SecuritySettings />);

        const switchBtn = screen.getByRole('switch');
        fireEvent.click(switchBtn);

        // Expect duration input to appear
        const durationInput = await screen.findByLabelText(/Durasi Timeout/i);
        expect(durationInput).toBeInTheDocument();
        expect(durationInput).toHaveValue(30);
    });

    it('saves settings to database', async () => {
        render(<SecuritySettings />);

        // Enable
        const switchBtn = screen.getByRole('switch');
        fireEvent.click(switchBtn);

        // Change Duration
        const durationInput = await screen.findByLabelText(/Durasi Timeout/i);
        fireEvent.change(durationInput, { target: { value: '60' } });

        // Save
        const saveBtn = screen.getByText('Simpan Perubahan');
        fireEvent.click(saveBtn);

        // Expect Supabase calls
        await waitFor(() => {
            expect(mockFrom).toHaveBeenCalledWith('stores');
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                settings: expect.objectContaining({
                    autoLockEnabled: true,
                    autoLockDuration: 60
                })
            }));
            expect(mockEq).toHaveBeenCalledWith('id', 'store123');
        });

        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Pengaturan Disimpan" }));
    });
});
