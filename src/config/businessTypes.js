export const BUSINESS_TYPES = {
    general: {
        id: 'general',
        label: 'Toko',
        features: ['pos', 'inventory', 'finance', 'reports', 'customers'],
        productFields: ['name', 'category', 'sku', 'barcode', 'sell_price', 'buy_price', 'stock', 'min_stock'],
        terminology: { customer: 'Pelanggan', product: 'Barang', sale: 'Penjualan' },
        settings: { showRental: false, showPetHotel: false }
    },
    fnb: {
        id: 'fnb',
        label: 'Food & Beverage',
        features: ['pos', 'inventory', 'finance', 'reports', 'customers', 'kitchen'],
        productFields: ['name', 'category', 'sku', 'barcode', 'sell_price', 'buy_price', 'stock', 'min_stock', 'is_raw_material', 'recipe'],
        terminology: { customer: 'Pelanggan', product: 'Menu', sale: 'Pesanan' },
        settings: { showRental: false, showPetHotel: false, enableTableManagement: true }
    },
    pharmacy: {
        id: 'pharmacy',
        label: 'Apotek',
        features: ['pos', 'inventory', 'finance', 'reports', 'customers', 'prescriptions'],
        productFields: ['name', 'category', 'sku', 'barcode', 'sell_price', 'buy_price', 'stock', 'min_stock', 'is_prescription_required', 'units'],
        terminology: { customer: 'Pasien', product: 'Obat', sale: 'Penjualan' },
        settings: { showRental: false, showPetHotel: false, enableExpiryTracking: true, enableTuslah: true }
    },
    laundry: {
        id: 'laundry',
        label: 'Laundry',
        features: ['pos', 'inventory', 'finance', 'reports', 'customers', 'services'],
        productFields: ['name', 'category', 'sku', 'sell_price'], // simplified fields for services
        terminology: { customer: 'Pelanggan', product: 'Layanan', sale: 'Order' },
        settings: { showRental: false, showPetHotel: false, enableStatusTracking: true }
    },
    rental: {
        id: 'rental',
        label: 'Rental',
        features: ['pos', 'inventory', 'finance', 'reports', 'customers', 'rental_timer'],
        productFields: ['name', 'category', 'sku', 'sell_price'], // usually hourly rates
        terminology: { customer: 'Penyewa', product: 'Item Sewa', sale: 'Sewa' },
        settings: { showRental: true, showPetHotel: false }
    },
    pet_clinic: {
        id: 'pet_clinic',
        label: 'Klinik Hewan',
        features: ['pos', 'inventory', 'finance', 'reports', 'customers', 'pet_hotel'],
        productFields: ['name', 'category', 'sku', 'barcode', 'sell_price', 'buy_price', 'stock', 'min_stock'],
        terminology: { customer: 'Pet Owner', product: 'Layanan/Produk', sale: 'Transkasi' },
        settings: { showRental: false, showPetHotel: true }
    }
};
