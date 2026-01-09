import { supabase } from '../supabase';

/**
 * Deletes all operational data for a specific store.
 * WARNING: This is destructive and irreversible.
 * 
 * @param {string} storeId - The ID of the store to clean up.
 * @returns {Promise<{success: boolean, error?: string, counts?: object}>}
 */
export const deleteStoreData = async (storeId) => {
    if (!storeId) {
        return { success: false, error: "Store ID is required" };
    }

    const tablesToDelete = [
        'products',
        'transactions',
        'stock_movements',
        'batches',
        'categories',
        'purchase_orders',
        'suppliers',
        'sales_targets',
        'promotions',
        'customers',
        'cash_flow',
        'shifts',
        'shift_movements',
        'stock_opname_sessions',
        'shopping_recommendations',
        'audit_logs',
        'rental_units',
        'rental_sessions'
    ];

    const stats = {};

    try {
        console.log(`Starting cleanup for store: ${storeId}`);

        for (const tableName of tablesToDelete) {
            const { count, error } = await supabase
                .from(tableName)
                .delete({ count: 'exact' })
                .eq('store_id', storeId);

            if (error) {
                console.error(`Error deleting from ${tableName}:`, error);
                stats[tableName] = "Error: " + error.message;
            } else {
                stats[tableName] = count || 0;
                console.log(`Deleted ${count || 0} rows from ${tableName}`);
            }
        }

        console.log("Cleanup complete!", stats);
        return { success: true, counts: stats };

    } catch (error) {
        console.error("Error deleting store data:", error);
        return { success: false, error: error.message };
    }
};
