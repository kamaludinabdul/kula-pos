
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use Anon Key (public)
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env Variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRpc() {
    console.log("Checking for 'add_session_item' RPC...");

    // Try to call it with dummy data. 
    // We expect "function not found" if it's missing.
    // We expect "permission denied" or actual logic error if it exists.
    const { data, error } = await supabase.rpc('add_session_item', {
        p_session_id: '00000000-0000-0000-0000-000000000000',
        p_store_id: '00000000-0000-0000-0000-000000000000',
        p_product_id: '00000000-0000-0000-0000-000000000000',
        p_qty: 1,
        p_price: 1000
    });

    if (error) {
        console.log("Result Error:", error.message);
        if (error.message.includes("Could not find the function") || error.code === '42883') {
            console.log("CONCLUSION: Function DOES NOT exist.");
        } else {
            console.log("CONCLUSION: Function EXISTS (but errored on logic/perm).");
            console.log("Detailed Error:", error);
        }
    } else {
        console.log("Result Success:", data);
        console.log("CONCLUSION: Function EXISTS.");
    }
}

checkRpc();
