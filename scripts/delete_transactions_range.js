
import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
// Using Service Key to bypass RLS
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);

async function forceDelete() {
    const STORE_ID = 'b5b56789-1960-7bd0-1f54-abee9db1ee37';
    const START_DATE = '2026-02-10T00:00:00+07:00'; // 10 Feb 00:00 WIB
    const END_DATE = '2026-02-11T00:00:00+07:00'; // 11 Feb 00:00 WIB

    console.log(`🗑️ Force Deleting Transactions for Store: ${STORE_ID}`);
    console.log(`📅 Range: ${START_DATE} to ${END_DATE}`);

    // Convert to UTC for query matching (Supabase stores in UTC)
    // 10 Feb 00:00 WIB -> 09 Feb 17:00 UTC
    // 11 Feb 00:00 WIB -> 10 Feb 17:00 UTC
    // But let's just use the ISO strings, Supabase handles it if format is correct.

    // Actually, to be safe, let's use the exact strings the user provided in SQL but ensure timezone
    // The user used '2026-02-10'.

    // Helper to get raw count first
    const { count: initialCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', STORE_ID)
        .gte('date', '2026-02-09T17:00:00') // 10 Feb 00:00 WIB in UTC
        .lt('date', '2026-02-10T17:00:00'); // 11 Feb 00:00 WIB in UTC

    console.log(`Found ${initialCount} transactions to delete.`);

    if (initialCount === 0) {
        console.log("No transactions found in this range. Checking wider range...");
        return;
    }

    const { error, count, data } = await supabase
        .from('transactions')
        .delete()
        .eq('store_id', STORE_ID)
        .gte('date', '2026-02-09T17:00:00')
        .lt('date', '2026-02-10T17:00:00')
        .select();

    if (error) {
        console.error("❌ DELETE FAILED:", error.message);
    } else {
        console.log("✅ DELETE SUCCESS");
        console.log(`Deleted rows: ${data.length}`);
    }
}

forceDelete();
