
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Use service key to bypass RLS

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Environment Variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugSchema() {
    console.log("Checking Cash Flow Schema...");

    // We can't directly query information_schema easily with js client unless expose it.
    // Instead we insert a dummy row and read it back to see the format, or just check a row.

    const { data: stores } = await supabase.from('stores').select('id').limit(1);
    if (!stores.length) return;
    const storeId = stores[0].id;

    const { data } = await supabase
        .from('cash_flow')
        .select('*')
        .eq('store_id', storeId)
        .limit(1);

    if (data && data.length > 0) {
        const row = data[0];
        console.log("Sample Row Date:", row.date, "Type:", typeof row.date);
        console.log("Sample Row Full:", row);
    } else {
        console.log("No data found to infer types.");
    }
}

debugSchema();
