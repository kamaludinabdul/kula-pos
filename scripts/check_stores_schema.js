
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStoresSchema() {
    console.log("Checking Stores Schema...");
    const { data } = await supabase.from('stores').select('*').limit(1);

    if (data && data.length > 0) {
        console.log("Store Columns:", Object.keys(data[0]));
        console.log("Sample Data:", data[0]);
    } else {
        console.log("No stores found.");
    }
}

checkStoresSchema();
