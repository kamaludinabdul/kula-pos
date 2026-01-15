
// --- PERMISSION SCHEMA ---
// --- PERMISSION SCHEMA ---
export const PERMISSION_SCHEMA = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        children: [
            { id: 'dashboard.view', label: 'Akses Halaman Dashboard' },
            { id: 'dashboard.operational', label: 'Statistik Operasional' },
            { id: 'dashboard.financials', label: 'Statistik Keuangan' },
            { id: 'dashboard.stock', label: 'Notifikasi Stok' }
        ]
    },
    {
        id: 'transactions',
        label: 'Transaksi',
        children: [
            { id: 'transactions.view', label: 'Lihat Riwayat' },
            { id: 'transactions.detail', label: 'Lihat Detail/Struk' },
            { id: 'transactions.print', label: 'Cetak Ulang Struk' },
            { id: 'transactions.refund', label: 'Refund / Void' }
        ]
    },
    {
        id: 'pos',
        label: 'Kasir (POS)',
        children: [
            { id: 'pos.access', label: 'Akses POS' },
            { id: 'pos.custom_price', label: 'Harga Manual' },
            { id: 'pos.discount', label: 'Diskon' },
            { id: 'pos.open_price', label: 'Ubah Harga' }
        ]
    },
    {
        id: 'database',
        label: 'Database (Master Data)',
        children: [
            // Returns to granular Product permissions
            { id: 'products.read', label: 'Produk: Lihat Daftar' },
            { id: 'products.create', label: 'Produk: Tambah Baru' },
            { id: 'products.update', label: 'Produk: Edit' },
            { id: 'products.delete', label: 'Produk: Hapus' },
            { id: 'products.stock', label: 'Produk: Opname Stok' },
            { id: 'products.import_export', label: 'Produk: Import / Export' },

            // Categories
            { id: 'categories.read', label: 'Kategori: Lihat' },
            { id: 'categories.create', label: 'Kategori: Tambah' },
            { id: 'categories.update', label: 'Kategori: Edit' },
            { id: 'categories.delete', label: 'Kategori: Hapus' },

            // Customers
            { id: 'customers.read', label: 'Pelanggan: Lihat' },
            { id: 'customers.create', label: 'Pelanggan: Tambah' },
            { id: 'customers.update', label: 'Pelanggan: Edit' },
            { id: 'customers.delete', label: 'Pelanggan: Hapus' },

            // Suppliers
            { id: 'suppliers.read', label: 'Supplier: Lihat' },
            { id: 'suppliers.create', label: 'Supplier: Tambah' },
            { id: 'suppliers.update', label: 'Supplier: Edit' },
            { id: 'suppliers.delete', label: 'Supplier: Hapus' },

            { id: 'products.purchase_orders', label: 'Purchase Order (Kulakan)' }
        ]
    },
    {
        id: 'finance',
        label: 'Keuangan',
        children: [
            { id: 'finance.cash_flow', label: 'Arus Kas (Cash Flow)' }
        ]
    },
    {
        id: 'reports',
        label: 'Laporan',
        children: [
            { id: 'reports.view', label: 'Akses Halaman Laporan' },
            { id: 'reports.profit_loss', label: 'Laba Rugi' },
            { id: 'reports.sales_items', label: 'Penjualan per Item' },
            { id: 'reports.sales_categories', label: 'Penjualan per Kategori' },
            { id: 'reports.inventory_value', label: 'Nilai Aset / Stok' },
            { id: 'reports.shifts', label: 'Laporan Shift & Pengeluaran' },
            { id: 'reports.performance', label: 'Performa Sales' },
            { id: 'reports.forecast', label: 'Forecasting (Prediksi)' }
        ]
    },
    {
        id: 'smart_insights',
        label: 'Smart Insights (AI)',
        children: [
            { id: 'smart_insights.bundling', label: 'Analisa Bundling / Market Basket' },
            { id: 'smart_insights.forecast', label: 'Sales Forecasting' },
            { id: 'smart_insights.segmentation', label: 'Segmentasi Pelanggan' }
        ]
    },
    {
        id: 'rental',
        label: 'Rental / Sewa',
        children: [
            { id: 'rental.access', label: 'Akses Dashboard Rental' }
        ]
    },
    {
        id: 'others',
        label: 'Lainnya',
        children: [
            { id: 'others.staff', label: 'Manajemen Staff (Lihat)' }, // App.jsx uses others.staff
            { id: 'others.login_history', label: 'Riwayat Login' }
        ]
    },
    {
        id: 'settings',
        label: 'Pengaturan',
        children: [
            { id: 'settings.profile', label: 'Profil Toko' },
            { id: 'settings.printer', label: 'Printer' },
            { id: 'settings.loyalty', label: 'Loyalty Point' },
            { id: 'settings.users', label: 'Manajemen User (Admin)' },
            { id: 'sales.target', label: 'Target Penjualan' } // App.jsx uses sales.target
        ]
    }
];

// --- DEFAULT ROLES (PRESETS) ---
export const ROLE_PRESETS = {
    staff: [
        'dashboard.view',
        'pos.access',
        'transactions.view', 'transactions.detail',
        'products.read', 'categories.read', 'customers.read', 'suppliers.read'
    ],
    sales: [
        'dashboard.view', 'dashboard.operational',
        'pos.access',
        'transactions.view', 'transactions.detail',
        'products.read', 'categories.read', 'customers.read', 'customers.create', 'suppliers.read',
        'reports.view', 'reports.performance'
    ],
    admin: [
        // ALL permissions included
        'dashboard.view', 'dashboard.operational', 'dashboard.financials', 'dashboard.stock',
        'transactions.view', 'transactions.detail', 'transactions.print', 'transactions.refund',
        'pos.access', 'pos.custom_price', 'pos.discount', 'pos.open_price',

        // Granular Master Data
        'products.read', 'products.create', 'products.update', 'products.delete', 'products.stock', 'products.import_export', 'products.purchase_orders',
        'categories.read', 'categories.create', 'categories.update', 'categories.delete',
        'customers.read', 'customers.create', 'customers.update', 'customers.delete',
        'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',

        'finance.cash_flow',
        'reports.view', 'reports.profit_loss', 'reports.sales_items', 'reports.sales_categories', 'reports.inventory_value', 'reports.shifts', 'reports.performance', 'reports.forecast',
        'smart_insights.bundling', 'smart_insights.forecast', 'smart_insights.segmentation',
        'rental.access',
        'others.staff', 'others.login_history',
        'settings.profile', 'settings.printer', 'settings.loyalty', 'settings.users', 'sales.target'
    ]
};

// Helper function to normalize and ensure complete permissions
export const normalizePermissions = (permissions) => {
    // If no permissions array (legacy user), return based on role hardcoding (backward compatibility)
    // But ideally, we should migrate them or just return what they have.
    // This function is mainly used when loading the profile to ensure shape.

    if (!permissions || permissions.length === 0) {
        // Fallback for legacy users without permissions array
        return {}; // Return empty to let the UI logic handle "role" based fallbacks if needed, 
        // OR we can return the defaults here based on a "role" argument if we had it.
        // But this function signature only takes 'permissions'.
        // So we rely on the component logical layers.
    }

    // For the UI, we just need the array.
    // For "checkPermission", we flatten.
    return permissions;
};

// Helper to get defaults by role
export const getPermissionsForRole = (role) => {
    if (!role) return [];
    return ROLE_PRESETS[role.toLowerCase()] || [];
};
