import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFeeForTransaction } from './petHotelFeeGenerator';

describe('Pet Hotel Fee Generator', () => {
    let mockSupabase;

    beforeEach(() => {
        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [] }), // Default: no duplicate
            insert: vi.fn().mockResolvedValue({ error: null })
        };
    });

    const mockStore = {
        id: 'store-1',
        settings: {
            pet_hotel_fee: {
                enabled: true,
                feePerDay: 50000,
                schedules: {
                    '2026-03': {
                        template: {
                            '1': [{ shift: 'Pagi', name: 'Alif' }, { shift: 'Sore', name: 'Bima' }], // Monday
                            '2': [{ shift: 'Full', name: 'Cika' }] // Tuesday
                        }
                    }
                }
            }
        }
    };

    it('should abort if fee feature is disabled', async () => {
        const storeDisabled = { ...mockStore, settings: { pet_hotel_fee: { enabled: false } } };
        const result = await generateFeeForTransaction({ id: 'tx-1', type: 'rental' }, storeDisabled, mockSupabase);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Fee feature disabled');
    });

    it('should skip if fees already exist for the transaction', async () => {
        mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'fee-1' }] });
        const result = await generateFeeForTransaction({ id: 'tx-1', type: 'rental' }, mockStore, mockSupabase);
        
        expect(result.success).toBe(false);
        expect(result.message).toBe('Fees already exist for this transaction');
        expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should distribute fee proportionately with weights (0.5 for half shifts)', async () => {
        const mockTransaction = {
            id: 'tx-123',
            type: 'rental',
            date: '2026-03-02T20:00:00', // Checkout Monday evening LOCAL
            payment_details: {
                snapshot: {
                    start_time: '2026-03-02T08:00:00' // Check-in Monday morning LOCAL
                }
            },
            items: [
                { category: 'Hotel', qty: 1, name: 'Sewa Kandang' } // 1 day paid = 50,000 budget
            ]
        };

        const result = await generateFeeForTransaction(mockTransaction, mockStore, mockSupabase);
        
        expect(result.success).toBe(true);
        expect(result.count).toBe(2);

        // Budget = 50,000. Pagi (0.5) + Sore (0.5) = 1.0 total weight.
        // Each should get 25,000
        const insertedData = mockSupabase.insert.mock.calls[0][0];
        expect(insertedData).toHaveLength(2);
        
        expect(insertedData[0].employee_name).toBe('Alif');
        expect(insertedData[0].fee_amount).toBe(25000);
        
        expect(insertedData[1].employee_name).toBe('Bima');
        expect(insertedData[1].fee_amount).toBe(25000);
    });

    it('should assign 1.0 weight for FULL shifts', async () => {
        const mockTransaction = {
            id: 'tx-124',
            type: 'rental',
            date: '2026-03-03T20:00:00', // Checkout Tuesday LOCAL
            payment_details: {
                snapshot: {
                    start_time: '2026-03-03T08:00:00' // Check-in Tuesday morning LOCAL
                }
            },
            items: [
                { category: 'Hotel', qty: 1, name: 'Sewa Kandang' } // 1 day paid = 50,000 budget
            ]
        };

        const result = await generateFeeForTransaction(mockTransaction, mockStore, mockSupabase);
        
        expect(result.success).toBe(true);
        expect(result.count).toBe(1);

        // Budget = 50,000. Full (1.0) total weight.
        // Cika gets 50,000
        const insertedData = mockSupabase.insert.mock.calls[0][0];
        expect(insertedData).toHaveLength(1);
        expect(insertedData[0].employee_name).toBe('Cika');
        expect(insertedData[0].fee_amount).toBe(50000);
    });

    it('should skip past shifts from Check-In day (e.g. Afternoon check-in skips Morning shift)', async () => {
        const mockTransaction = {
            id: 'tx-125',
            type: 'rental',
            date: '2026-03-02T22:00:00', // Checkout Monday late LOCAL
            payment_details: {
                snapshot: {
                    start_time: '2026-03-02T15:00:00' // Check-in Monday AFTERNOON LOCAL
                }
            },
            items: [
                { category: 'Hotel', qty: 1, name: 'Sewa Kandang' } // 1 day paid = 50,000
            ]
        };

        const result = await generateFeeForTransaction(mockTransaction, mockStore, mockSupabase);
        
        expect(result.success).toBe(true);
        expect(result.count).toBe(1); // Only Sore shift should get it

        // Budget = 50,000. Only Sore active. Total weight = 0.5.
        // 50,000 / 0.5 = 100,000 feeUnit. Sore weight 0.5 = 50,000
        const insertedData = mockSupabase.insert.mock.calls[0][0];
        expect(insertedData).toHaveLength(1);
        expect(insertedData[0].employee_name).toBe('Bima');
        expect(insertedData[0].shift_label).toContain('Sore');
        expect(insertedData[0].fee_amount).toBe(50000); // Because Alif (Pagi) was bypassed
    });
});
