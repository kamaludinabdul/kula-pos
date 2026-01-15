import { describe, it, expect } from 'vitest';
import { getPermissionsForRole, ROLE_PRESETS } from './permissions';

describe('Permissions System', () => {
    describe('getPermissionsForRole', () => {
        it('should return correct permissions for "admin"', () => {
            const permissions = getPermissionsForRole('admin');
            expect(permissions).toContain('transactions.refund');
            expect(permissions).toContain('products.delete');
            expect(permissions).toContain('settings.users');
        });

        it('should return correct permissions for "staff"', () => {
            const permissions = getPermissionsForRole('staff');
            expect(permissions).toContain('pos.access');
            expect(permissions).toContain('products.read');
            // Staff should NOT have these by default
            expect(permissions).not.toContain('transactions.void');
            expect(permissions).not.toContain('products.delete');
        });

        it('should return correct permissions for "sales"', () => {
            const permissions = getPermissionsForRole('sales');
            expect(permissions).toContain('reports.view');
            expect(permissions).toContain('products.read');
            // Sales should NOT have delete access
            expect(permissions).not.toContain('products.delete');
        });

        it('should be case insensitive', () => {
            const adminPerms = getPermissionsForRole('ADMIN');
            const staffPerms = getPermissionsForRole('Staff');
            expect(adminPerms).toEqual(ROLE_PRESETS.admin);
            expect(staffPerms).toEqual(ROLE_PRESETS.staff);
        });

        it('should return empty array for unknown role', () => {
            const permissions = getPermissionsForRole('unknown_role');
            expect(permissions).toEqual([]);
        });
    });

    describe('ROLE_PRESETS', () => {
        it('should have defined presets for core roles', () => {
            expect(ROLE_PRESETS).toHaveProperty('admin');
            expect(ROLE_PRESETS).toHaveProperty('staff');
            expect(ROLE_PRESETS).toHaveProperty('sales');
        });

        it('admin role should have significantly more permissions than staff', () => {
            expect(ROLE_PRESETS.admin.length).toBeGreaterThan(ROLE_PRESETS.staff.length);
        });
    });
});
