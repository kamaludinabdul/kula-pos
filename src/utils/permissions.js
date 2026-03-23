
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
        id: 'clinic',
        label: 'Klinik & Pet Care',
        children: [
            { id: 'clinic.pets.read', label: 'Hewan: Lihat Daftar' },
            { id: 'clinic.pets.create', label: 'Hewan: Tambah Baru' },
            { id: 'clinic.medical_records.read', label: 'Rekam Medis: Lihat' },
            { id: 'clinic.medical_records.create', label: 'Rekam Medis: Tambah' },
            { id: 'clinic.bookings', label: 'Pet Hotel: Bookings' },
            { id: 'clinic.rooms', label: 'Pet Hotel: Kamar & Fasilitas' },
            { id: 'clinic.services', label: 'Hewan: Kelola Layanan' }
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
            { id: 'products.read', label: 'Produk: Lihat Daftar' },
            { id: 'products.create', label: 'Produk: Tambah Baru' },
            { id: 'products.update', label: 'Produk: Edit' },
            { id: 'products.delete', label: 'Produk: Hapus' },
            { id: 'products.stock', label: 'Produk: Opname Stok' },
            { id: 'products.import_export', label: 'Produk: Import / Export' },
            { id: 'products.promotions', label: 'Produk: Promo & Diskon' },

            { id: 'categories.read', label: 'Kategori: Lihat' },
            { id: 'categories.create', label: 'Kategori: Tambah' },
            { id: 'categories.update', label: 'Kategori: Edit' },
            { id: 'categories.delete', label: 'Kategori: Hapus' },

            { id: 'customers.read', label: 'Pelanggan: Lihat' },
            { id: 'customers.create', label: 'Pelanggan: Tambah' },
            { id: 'customers.update', label: 'Pelanggan: Edit' },
            { id: 'customers.delete', label: 'Pelanggan: Hapus' },

            { id: 'suppliers.read', label: 'Supplier: Lihat' },
            { id: 'suppliers.create', label: 'Supplier: Tambah' },
            { id: 'suppliers.update', label: 'Supplier: Edit' },
            { id: 'suppliers.delete', label: 'Supplier: Hapus' },

            { id: 'products.purchase_orders', label: 'Purchase Order (Kulakan)' },
            { id: 'products.stock_opname', label: 'Produk: Stock Opname' }
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
            { id: 'reports.forecast', label: 'Forecasting (Prediksi)' },
            { id: 'reports.expiry', label: 'Laporan Kadaluarsa' },
            { id: 'reports.defecta', label: 'Laporan Defecta (Stok Kritis)' },
            { id: 'reports.patient_history', label: 'Riwayat Obat Pasien' },
            { id: 'reports.tuslah', label: 'Laporan Tuslah' },
            { id: 'reports.customer_profiling', label: 'Profiling Pelanggan' },
            { id: 'reports.pet_hotel_fee', label: 'Laporan Pet Hotel' },
            { id: 'reports.top_selling', label: 'Produk Terlaris' },
            { id: 'reports.doctor_commissions', label: 'Laporan Komisi Dokter' }
        ]
    },
    {
        id: 'smart_insights',
        label: 'Smart Insights (AI)',
        children: [
            { id: 'smart_insights.bundling', label: 'Analisa Bundling / Market Basket' },
            { id: 'smart_insights.forecast', label: 'Sales Forecasting' },
            { id: 'smart_insights.segmentation', label: 'Segmentasi Pelanggan' },
            { id: 'smart_insights.analysis', label: 'Analisa Penjualan' }
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
            { id: 'others.staff', label: 'Manajemen Staff (Lihat)' },
            { id: 'others.login_history', label: 'Riwayat Login' }
        ]
    },
    {
        id: 'settings',
        label: 'Pengaturan',
        children: [
            { id: 'settings.general', label: 'Pengaturan Umum' },
            { id: 'settings.profile', label: 'Profil Toko' },
            { id: 'settings.subscription', label: 'Paket & Langganan' },
            { id: 'settings.fees', label: 'Biaya, Pajak & Komisi' },
            { id: 'settings.printer', label: 'Printer & Struk' },
            { id: 'settings.loyalty', label: 'Loyalty Point' },
            { id: 'settings.telegram', label: 'Notifikasi Telegram' },
            { id: 'settings.sales_performance', label: 'Target Penjualan' },
            { id: 'settings.security', label: 'Keamanan / PIN' },
            { id: 'settings.users', label: 'Manajemen Hak Akses' },
            { id: 'sales.target', label: 'Target Sales' }
        ]
    }
];

// --- DEFAULT ROLES (PRESETS) ---
export const ROLE_PRESETS = {
    staff: [
        'dashboard.view',
        'pos.access',
        'transactions.view', 'transactions.detail',
        'products.read', 'categories.read', 'customers.read', 'suppliers.read',
        'clinic.pets.read', 'clinic.medical_records.read'
    ],
    sales: [
        'dashboard.view', 'dashboard.operational',
        'pos.access',
        'transactions.view', 'transactions.detail',
        'products.read', 'categories.read', 'customers.read', 'customers.create', 'suppliers.read',
        'reports.view', 'reports.performance',
        'settings.profile', 'settings.printer'
    ],
    admin: [
        'dashboard.view', 'dashboard.operational', 'dashboard.financials', 'dashboard.stock',
        'transactions.view', 'transactions.detail', 'transactions.print', 'transactions.refund',
        'pos.access', 'pos.custom_price', 'pos.discount', 'pos.open_price',
        'products.read', 'products.create', 'products.update', 'products.delete', 'products.stock', 'products.import_export', 'products.purchase_orders', 'products.stock_opname', 'products.promotions',
        'categories.read', 'categories.create', 'categories.update', 'categories.delete',
        'customers.read', 'customers.create', 'customers.update', 'customers.delete',
        'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
        'finance.cash_flow',
        'reports.view', 'reports.profit_loss', 'reports.sales_items', 'reports.sales_categories', 'reports.inventory_value', 'reports.shifts', 'reports.performance', 'reports.forecast', 'reports.expiry', 'reports.defecta', 'reports.patient_history', 'reports.tuslah', 'reports.customer_profiling', 'reports.pet_hotel_fee', 'reports.top_selling', 'reports.loyalty', 'reports.doctor_commissions',
        'smart_insights.bundling', 'smart_insights.forecast', 'smart_insights.segmentation', 'smart_insights.analysis',
        'rental.access',
        'others.staff', 'others.login_history',
        'settings.general', 'settings.profile', 'settings.subscription', 'settings.fees', 'settings.printer', 'settings.loyalty', 'settings.telegram', 'settings.sales_performance', 'settings.security', 'settings.users', 'sales.target',
        'clinic.pets.read', 'clinic.pets.create', 'clinic.medical_records.read', 'clinic.medical_records.create', 'clinic.bookings', 'clinic.rooms', 'clinic.services'
    ],
    dokter: [
        'dashboard.view', 'dashboard.operational',
        'pos.access',
        'transactions.view', 'transactions.detail',
        'products.read', 'categories.read', 'customers.read', 'customers.create',
        'reports.view', 'reports.patient_history', 'reports.performance', 'reports.doctor_commissions',
        'clinic.pets.read', 'clinic.medical_records.read', 'clinic.medical_records.create', 'clinic.services',
        'settings.profile', 'settings.printer'
    ],
    pramedic: [
        'dashboard.view',
        'pos.access',
        'transactions.view', 'transactions.detail',
        'products.read', 'categories.read', 'customers.read', 'customers.create',
        'reports.view', 'reports.patient_history',
        'clinic.pets.read', 'clinic.medical_records.read', 'clinic.medical_records.create', 'clinic.services',
        'settings.profile', 'settings.printer'
    ],
    groomer: [
        'dashboard.view',
        'pos.access',
        'transactions.view', 'transactions.detail',
        'products.read', 'categories.read', 'customers.read',
        'clinic.pets.read', 'clinic.bookings',
        'settings.profile', 'settings.printer'
    ]
};

// Helper function to normalize and ensure complete permissions
export const normalizePermissions = (permissions) => {
    if (!permissions || permissions.length === 0) {
        return {}; 
    }
    return permissions;
};

// Helper to get defaults by role
export const getPermissionsForRole = (role) => {
    if (!role) return [];
    return ROLE_PRESETS[role.toLowerCase()] || [];
};
