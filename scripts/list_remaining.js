
import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);
const STORE_ID = 'b5b56789-1960-7bd0-1f54-abee9db1ee37';

async function listRemaining() {
    console.log("🔍 Listing Remaining Transactions for Feb 10 (Store FAMS PET)");

    const { data } = await supabase.from('transactions')
        .select('id, date, total, created_at')
        .eq('store_id', STORE_ID)
        .gte('date', '2026-02-09T17:00:00') // Feb 10
        .lt('date', '2026-02-10T17:00:00') // Feb 11
        .limit(10);

    console.log(`Found ${data.length} transactions.`);
    data.forEach(t => {
        console.log(`- ID: ${t.id} | Date: ${t.date} | Total: ${t.total}`);
    });
}

listRemaining();
