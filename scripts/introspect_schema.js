
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

async function introspect() {
    console.log("Introspecting relationships for 'stores' and 'profiles'...");

    // Check stores columns
    const { data: storesData, error: storesError } = await supabase.from('stores').select('*').limit(1);
    if (storesError) {
        console.error("Error fetching store:", storesError.message);
    } else {
        console.log("Store Columns:", Object.keys(storesData[0] || {}));
    }

    // Check profiles columns
    const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*').limit(1);
    if (profilesError) {
        console.error("Error fetching profile:", profilesError.message);
    } else {
        console.log("Profile Columns:", Object.keys(profilesData[0] || {}));
    }

    // Test specific join with owner_id hint again, but with DIFFERENT syntax
    console.log("\n--- Testing owner:profiles!stores_owner_id_fkey ---");
    const { data: test1, error: err1 } = await supabase.from('stores').select('name, owner:profiles!stores_owner_id_fkey(name, email, plan)').limit(1);
    if (err1) console.log("FAILED 1:", err1.message);
    else console.log("SUCCESS 1", test1[0]);

    console.log("\n--- Testing owner:profiles!owner_id ---");
    const { data: test2, error: err2 } = await supabase.from('stores').select('name, owner:profiles!owner_id(name, email, plan)').limit(1);
    if (err2) console.log("FAILED 2:", err2.message);
    else console.log("SUCCESS 2", test2[0]);

    // Check if there is a 'owner' profile that matches
    if (storesData && storesData[0]?.owner_id) {
        console.log("\nAttempting manual lookup of owner_id:", storesData[0].owner_id);
        const { data: ownerLookup, error: lookupErr } = await supabase.from('profiles').select('*').eq('id', storesData[0].owner_id).single();
        if (lookupErr) console.error("Lookup failed:", lookupErr.message);
        else console.log("Lookup success:", ownerLookup);
    }
}

introspect();
