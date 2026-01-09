import { db } from '../db';

export const offlineService = {
    // --- Caching Data ---
    async cacheData(storeId, products, categories, customers) {
        try {
            await db.transaction('rw', db.products, db.categories, db.customers, async () => {
                // Clear old cache for this store to ensure freshness
                await db.products.where('store_id').equals(storeId).delete();
                await db.categories.where('store_id').equals(storeId).delete();
                await db.customers.where('store_id').equals(storeId).delete();

                // Bulk add
                if (products.length) await db.products.bulkPut(products.map(p => ({ ...p, store_id: storeId })));
                if (categories.length) await db.categories.bulkPut(categories.map(c => ({ ...c, store_id: storeId })));
                if (customers.length) await db.customers.bulkPut(customers.map(c => ({ ...c, store_id: storeId })));
            });
            console.log('Offline cache updated');
        } catch (error) {
            console.error('Failed to update offline cache', error);
        }
    },

    async loadFromCache(storeId) {
        const products = await db.products.where('store_id').equals(storeId).toArray();
        const categories = await db.categories.where('store_id').equals(storeId).toArray();
        const customers = await db.customers.where('store_id').equals(storeId).toArray();
        return { products, categories, customers };
    },

    // --- Offline Transactions ---
    async saveOfflineTransaction(transactionData) {
        try {
            const id = await db.offline_transactions.add({
                ...transactionData,
                status: 'pending_sync',
                offlineId: Date.now() // temporary ID
            });
            return { success: true, id, offline: true };
        } catch (error) {
            console.error('Failed to save offline transaction', error);
            return { success: false, error: 'Storage failed' };
        }
    },

    async getPendingTransactions(storeId) {
        return await db.offline_transactions
            .where('store_id').equals(storeId)
            .and(t => t.status === 'pending_sync')
            .toArray();
    },

    async syncTransactions(storeId, processSaleFn) {
        const pending = await this.getPendingTransactions(storeId);
        if (pending.length === 0) return { synced: 0, errors: 0 };

        let synced = 0;
        let errors = 0;

        for (const tx of pending) {
            try {
                // Remove internal Dexie ID before sending to Firestore
                const { id, ...dataToSync } = tx;

                const result = await processSaleFn(dataToSync);
                if (result.success) {
                    await db.offline_transactions.delete(id); // Remove from queue
                    synced++;
                } else {
                    console.error('Sync failed for tx', id, result.error);
                    errors++;
                }
            } catch (err) {
                console.error('Sync error', err);
                errors++;
            }
        }
        return { synced, errors };
    },

    async getCreateCount(storeId) {
        return await db.offline_transactions.where('store_id').equals(storeId).count();
    }
};
