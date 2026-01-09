import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://jsylclofqbqdutccsrxb.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NzExNiwiZXhwIjoyMDgzNDczMTE2fQ.Aqs2ODInyTyIYq_uzwuXpvZC4XdEzBU61Rc66deXUFs";

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCounts() {
    console.log("📊 Verifying Database Counts...");

    const tables = [
        'stores',
        'profiles',
        'products',
        'categories',
        'customers',
        'suppliers',
        'transactions',
        'cash_flow',
        'purchase_orders',
        'shifts',
        'pets',
        'medical_records',
        'rooms',
        'bookings',
        'rental_units',
        'rental_sessions',
        'stock_movements'
    ];

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            // Some tables might not exist or verify failed
            console.log(`❌ ${table}: Error - ${error.message}`);
        } else {
            console.log(`✅ ${table}: ${count} records`);
        }
    }

    // Also check ONE transaction to see its store_id
    const { data: sampleTx } = await supabase.from('transactions').select('store_id').limit(1);
    if (sampleTx && sampleTx.length > 0) {
        console.log(`\nℹ️ Sample Transaction Store ID: ${sampleTx[0].store_id}`);
    }

    // Check stores IDs
    const { data: stores } = await supabase.from('stores').select('id, name');
    console.log("\nℹ️ Available Stores:");
    stores.forEach(s => console.log(`   - [${s.name}] ${s.id}`));
}

verifyCounts();
