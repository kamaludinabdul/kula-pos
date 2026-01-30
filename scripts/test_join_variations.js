
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
    console.log("Checking constraints for 'stores'...");

    // We can use an RPC that runs SQL if it exists, or try to infer from queries
    // Let's try to query the information_schema indirectly if possible, but usually not.
    // Instead, let's try a few more join variations.

    const variations = [
        'profiles!owner_id(*)',
        'profiles!stores_owner_id_fkey(*)',
        'profiles!stores_owner_fkey(*)',
        'profiles!owner(*)',
    ];

    for (const v of variations) {
        console.log(`Testing query: stores(name, ${v})`);
        const { data, error } = await supabase.from('stores').select(`name, ${v}`).limit(1);
        if (error) {
            console.log(`- FAILED: ${error.message}`);
        } else {
            console.log(`- SUCCESS:`, data[0]);
        }
    }
}

checkConstraints();
