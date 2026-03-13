import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
    console.log("--- Diagnostic Report ---");
    
    // 1. Check latest store
    const { data: stores, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (storeError) {
        console.error("Error fetching latest store:", storeError);
    } else if (stores && stores.length > 0) {
        console.log("Latest Store:", JSON.stringify(stores[0], null, 2));
    } else {
        console.log("No stores found.");
    }

    // 2. Check latest profile
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (profileError) {
        console.error("Error fetching latest profile:", profileError);
    } else if (profiles && profiles.length > 0) {
        console.log("Latest Profile:", JSON.stringify(profiles[0], null, 2));
    } else {
        console.log("No profiles found.");
    }

    // 3. Check debug_logs
    const { data: logs, error: logError } = await supabase
        .from('debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (logError) {
        // Table might not exist yet if script hasn't run
        console.log("debug_logs table not found or error:", logError.message);
    } else if (logs && logs.length > 0) {
        console.log("Recent Debug Logs:", JSON.stringify(logs, null, 2));
    } else {
        console.log("No debug logs found.");
    }
}

diagnose();
