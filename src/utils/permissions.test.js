import { describe, it, expect } from 'vitest';
import { normalizePermissions } from './permissions';

describe('normalizePermissions', () => {
    it('should assign default admin permissions including void and refund', () => {
        const permissions = null; // simulate fresh permission generation
        const result = normalizePermissions(permissions);

        expect(result.admin).toContain('transactions.void');
        expect(result.admin).toContain('transactions.refund');
        expect(result.super_admin).toContain('transactions.void');
    });

    it('should assign valid defaults for staff (kasir) WITHOUT void/refund', () => {
        const permissions = null;
        const result = normalizePermissions(permissions);

        expect(result.staff).toContain('pos');
        expect(result.staff).toContain('transactions');
        expect(result.staff).not.toContain('transactions.void');
        expect(result.staff).not.toContain('transactions.refund');
    });

    it('should preserve void/refund if manually added to a role', () => {
        const input = {
            staff: ['pos', 'transactions', 'transactions.void']
        };
        const result = normalizePermissions(input);

        expect(result.staff).toContain('transactions.void');
        // Should not magically add refund if we didn't ask for it
        expect(result.staff).not.toContain('transactions.refund');
    });

    it('should correct admin permissions if they are missing void/refund (migration scenario)', () => {
        // Simulate an old admin who has 'transactions' but misses granular rights
        const input = {
            admin: ['dashboard', 'transactions']
        };
        const result = normalizePermissions(input);

        expect(result.admin).toContain('transactions.void');
        expect(result.admin).toContain('transactions.refund');
    });

    it('should NOT give void/refund to staff even if they have transactions (migration scenario)', () => {
        // Simulate an old staff who has 'transactions'
        const input = {
            staff: ['dashboard', 'transactions']
        };
        const result = normalizePermissions(input);

        expect(result.staff).toContain('transactions');
        expect(result.staff).not.toContain('transactions.void');
        expect(result.staff).not.toContain('transactions.refund');
    });
});
