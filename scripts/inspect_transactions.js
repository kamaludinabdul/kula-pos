
import { createClient } from '@supabase/supabase-js';

const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);

async function inspect() {
    console.log("🔍 Inspecting transactions for store: b5b56789-1960-7bd0-1f54-abee9db1ee37");

    // Fetch transactions that LOOK like they are from Feb 10
    // We'll broaden the search to catch timezone shifts (Feb 9 to Feb 11)
    const { data, error } = await supabase
        .from('transactions')
        .select('id, date, created_at, total')
        .eq('store_id', 'b5b56789-1960-7bd0-1f54-abee9db1ee37')
        .gte('date', '2026-02-09')
        .lt('date', '2026-02-12')
        .limit(20);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data.length} transactions around that date.`);
    console.log("---------------------------------------------------");
    data.forEach(t => {
        console.log(`ID: ${t.id}`);
        console.log(`Raw Date      : ${t.date}`);
        console.log(`Raw CreatedAt : ${t.created_at}`);
        console.log(`Total         : ${t.total}`);
        console.log("---------------------------------------------------");
    });
}

inspect();
