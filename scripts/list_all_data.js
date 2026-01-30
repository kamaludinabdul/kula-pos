
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

async function listAll() {
    console.log("--- Listing All Stores ---");
    const { data: stores, error: sErr } = await supabase.from('stores').select('id, name, owner_id, plan');
    if (sErr) console.log("Stores Err:", sErr.message);
    else console.log("Stores:", stores);

    console.log("\n--- Listing All Profiles ---");
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, name, email, plan');
    if (pErr) console.log("Profiles Err:", pErr.message);
    else console.log("Profiles:", profiles);

    console.log("\n--- Listing All Invoices ---");
    const { data: invoices, error: iErr } = await supabase.from('subscription_invoices').select('id, store_id, plan_id, status');
    if (iErr) console.log("Invoices Err:", iErr.message);
    else console.log("Invoices:", invoices);
}

listAll();
