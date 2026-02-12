
import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);

const STORE_ID = 'b5b56789-1960-7bd0-1f54-abee9db1ee37';
const DELETED_TX_ID = '260212090223302'; // The one we deleted manually first

async function audit() {
    console.log("🔍 Auditing Data Integrity for Store: FAMS PET");

    // 1. Check surrounding dates
    const { count: countFeb9 } = await supabase.from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', STORE_ID)
        .gte('date', '2026-02-08T17:00:00') // Feb 9
        .lt('date', '2026-02-09T17:00:00'); // Feb 10

    const { count: countFeb10 } = await supabase.from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', STORE_ID)
        .gte('date', '2026-02-09T17:00:00') // Feb 10
        .lt('date', '2026-02-10T17:00:00'); // Feb 11

    const { count: countFeb11 } = await supabase.from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', STORE_ID)
        .gte('date', '2026-02-10T17:00:00') // Feb 11
        .lt('date', '2026-02-11T17:00:00'); // Feb 12

    console.log(`\n📊 Transaction Counts:`);
    console.log(`- Feb 09: ${countFeb9} (Safe)`);
    console.log(`- Feb 10: ${countFeb10} (Should be 0)`);
    console.log(`- Feb 11: ${countFeb11} (Safe)`);

    // 2. Check Stock Movements for the deleted transaction
    // If they exist, it means stock history was NOT deleted (orphaned log)
    // If they are gone, it means they were cascaded (deleted)
    const { data: movements } = await supabase.from('stock_movements')
        .select('id, product_id, qty, ref_id')
        .eq('ref_id', DELETED_TX_ID);

    console.log(`\n📦 Stock Movements for Deleted TX (${DELETED_TX_ID}):`);
    if (movements && movements.length > 0) {
        console.log(`⚠️ Found ${movements.length} orphaned stock movement(s).`);
        console.log(`   (This means the stock deduction history is still there, but transaction is gone.)`);
        console.log(`   (Your product stock counts have NOT been reverted.)`);
    } else {
        console.log(`✅ No stock movements found (Likely deleted via Cascade).`);
        console.log(`   (Or ref_id was not set strictly. But usually this means history is clean.)`);
    }

}

audit();
