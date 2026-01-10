
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStoresTable() {
    console.log("Checking 'stores' table columns...");

    const { data, error } = await supabase.from('stores').select('*').limit(1);

    if (error) {
        console.error("❌ Error fetching from stores:", error.message);
        return;
    }

    if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log("Current columns in 'stores':", columns);

        const required = ['logo', 'latitude', 'longitude'];
        const missing = required.filter(c => !columns.includes(c));

        if (missing.length > 0) {
            console.error("❌ Missing columns:", missing);
        } else {
            console.log("✅ All required columns (logo, latitude, longitude) exist.");
        }
    } else {
        console.log("❓ No data in stores table to check columns via SELECT *.");
    }
}

checkStoresTable();
