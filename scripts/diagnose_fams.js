
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

async function diagnoseFamsPet() {
    console.log("--- Diagnosing 'FAMS PET' and 'rhpetshop25@gmail.com' ---");

    // 1. Find the store
    const { data: stores, error: sErr } = await supabase
        .from('stores')
        .select('*, owner:profiles!stores_owner_id_fkey(*)')
        .ilike('name', '%FAMS PET%');

    if (sErr) console.error("Store Fetch Error:", sErr.message);
    else console.log("Stores Found:", JSON.stringify(stores, null, 2));

    // 2. Find the profile regardless of store link
    const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', '%rhpetshop25@gmail.com%');

    if (pErr) console.error("Profile Fetch Error:", pErr.message);
    else console.log("Profiles Found matching email:", JSON.stringify(profiles, null, 2));

    // 3. Find recent invoices for FAMS PET
    const { data: invoices, error: iErr } = await supabase
        .from('subscription_invoices')
        .select(`
            *,
            stores:store_id (
                name,
                owner_id
            )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (iErr) console.error("Invoice Fetch Error:", iErr.message);
    else console.log("Recent Invoices:", JSON.stringify(invoices, null, 2));
}

diagnoseFamsPet();
