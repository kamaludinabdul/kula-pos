import Dexie from 'dexie';

export const db = new Dexie('KulaPOS_DB');

db.version(1).stores({
    products: 'id, store_id, name, category', // Primary key and indexed props
    categories: 'id, store_id',
    customers: 'id, store_id, name, phone',
    offline_transactions: '++id, store_id, date, status' // Auto-increment ID for queue
});

// Helper to check if data exists
export const isCacheValid = async (table, storeId) => {
    const count = await table.where('store_id').equals(storeId).count();
    return count > 0;
};
