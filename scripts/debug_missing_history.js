
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Environment Variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugMissingData() {
    console.log("Searching for Cash Flow Data (Jan 1 - Jan 15)...");

    // 1. Get first store
    const { data: stores } = await supabase.from('stores').select('id, name').limit(1);
    if (!stores.length) return;
    const store = stores[0];
    console.log(`Store: ${store.name} (${store.id})`);

    // 2. Fetch ALL records for this period, ignore category filter for now
    const { data, error } = await supabase
        .from('cash_flow')
        .select('id, date, category, amount, created_at')
        .eq('store_id', store.id)
        .gte('date', '2026-01-01')
        .lte('date', '2026-01-15')
        .order('date', { ascending: true });

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data.length} records:`);
    data.forEach(d => {
        console.log(`[${d.date}] ${d.category} - Rp ${d.amount}`);
    });
}

debugMissingData();
