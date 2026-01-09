// Helper function to normalize and ensure complete permissions
export const normalizePermissions = (permissions) => {
    if (!permissions) {
        const adminPermissions = [
            'dashboard',
            'pos',
            'transactions',
            'products.manage', 'products.list', 'products.categories', 'products.stock', 'products.stock_opname', 'products.customers', 'products.suppliers', 'products.purchase_orders',
            'reports.profit_loss', 'reports.sales_items', 'reports.top_selling', 'reports.sales_categories',
            'reports.inventory_value', 'reports.shifts', 'reports.expenses', 'reports.loyalty', 'reports.performance', 'reports.forecast',
            'sales.target',
            'finance.cash_flow',
            'transactions.void', 'transactions.refund',
            'others.staff', 'others.login_history', 'shifts.close_others',
            'settings.profile', 'settings.subscription', 'settings.fees', 'settings.printer',
            'settings.loyalty', 'settings.sales_performance', 'settings.telegram', 'settings.access'
        ];
        return {
            super_admin: adminPermissions,
            owner: adminPermissions,
            admin: adminPermissions,
            staff: ['pos', 'dashboard', 'transactions'],
            sales: ['pos', 'dashboard', 'transactions']
        };
    }

    const normalized = { ...permissions };

    const expandBroadPermission = (roleSet, broadKey, subPermissions) => {
        if (roleSet.has(broadKey)) {
            roleSet.delete(broadKey);
            subPermissions.forEach(p => roleSet.add(p));
        }
    };

    // Dynamic Normalization for ALL roles (catches 'cashier', 'custom', etc.)
    Object.keys(normalized).forEach(role => {
        const roleSet = new Set(normalized[role]);

        // 1. Settings Expansion (Admin gets all, others get restricted list if they had broad 'settings')
        if (roleSet.has('settings')) {
            const allSettings = [
                'settings.profile', 'settings.subscription', 'settings.fees', 'settings.printer',
                'settings.loyalty', 'settings.sales_performance', 'settings.telegram', 'settings.access'
            ];

            // Filter out sensitive settings for non-admins
            const allowedSettings = (role === 'admin' || role === 'owner' || role === 'super_admin')
                ? allSettings
                : allSettings.filter(s => s !== 'settings.access' && s !== 'settings.fees' && s !== 'settings.subscription');

            expandBroadPermission(roleSet, 'settings', allowedSettings);
        } else if (role === 'admin' || role === 'owner' || role === 'super_admin') {
            // Admin always gets full settings if not present (or if we are just ensuring defaults)
            // But expandBroadPermission only runs if 'settings' key exists.
            // We need to ensure Admin has them regardless? 
            // Existing code implies we trust admins to have 'settings' or we add them manually?
            // Actually, 'admin' block at top defines default. 
            // This loop is for normalizing potential DB data.
        }

        // 2. Products Expansion (Crucial for migration)
        if (roleSet.has('products')) {
            // Default expansion for products - give at least list access
            // For admin we give more, for others just list usually, but let's be safe and give list + granular checks will filter
            const expansion = (role === 'admin' || role === 'owner' || role === 'super_admin')
                ? ['products.manage', 'products.list', 'products.categories', 'products.stock', 'products.customers', 'products.suppliers', 'products.purchase_orders']
                : ['products.list'];

            expandBroadPermission(roleSet, 'products', expansion);
        }

        // 3. Reports Expansion
        if (roleSet.has('reports')) {
            expandBroadPermission(roleSet, 'reports', [
                'reports.profit_loss', 'reports.sales_items', 'reports.sales_categories',
                'reports.inventory_value', 'reports.shifts', 'reports.expenses', 'reports.loyalty', 'reports.performance',
                'reports.forecast' // Added missing forecast
            ]);
        }

        // 4. Sales Expansion
        if (roleSet.has('sales')) {
            expandBroadPermission(roleSet, 'sales', ['sales.target']);
        }

        // 5. Transactions Augmentation (Backfill for Admins)
        if (roleSet.has('transactions') && (role === 'admin' || role === 'owner' || role === 'super_admin')) {
            roleSet.add('transactions.void');
            roleSet.add('transactions.refund');
        }

        // 5. Force valid defaults for known roles if missing
        if (role === 'staff' || role === 'sales' || role === 'cashier') {
            ['dashboard', 'transactions'].forEach(p => roleSet.add(p));
        }

        normalized[role] = Array.from(roleSet);
    });

    return normalized;
};
