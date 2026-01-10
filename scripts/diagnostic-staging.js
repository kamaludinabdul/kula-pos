
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runDiagnostics() {
    console.log("Checking Supabase Connection...");

    // 1. Check RPC existence
    console.log("\n1. Checking get_store_initial_snapshot RPC...");
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const { error: rpcError } = await supabase.rpc('get_store_initial_snapshot', { p_store_id: fakeId });

    if (rpcError) {
        if (rpcError.message.includes("does not exist")) {
            console.error("❌ RPC 'get_store_initial_snapshot' NOT FOUND. Did you run optimize-supabase.sql?");
        } else {
            console.log("✅ RPC 'get_store_initial_snapshot' found (returned expected error for fake ID: " + rpcError.message + ")");
        }
    } else {
        console.log("✅ RPC 'get_store_initial_snapshot' found.");
    }

    // 2. Check Profiles table
    console.log("\n2. Checking 'profiles' table...");
    const { error: profError } = await supabase.from('profiles').select('*').limit(1);
    if (profError) {
        console.error("❌ Error accessing profiles:", profError.message);
    } else {
        console.log("✅ 'profiles' table accessible.");
    }

    // 3. Check Stores table
    console.log("\n3. Checking 'stores' table...");
    const { error: storesError } = await supabase.from('stores').select('*').limit(1);
    if (storesError) {
        console.error("❌ Error accessing stores:", storesError.message);
    } else {
        console.log("✅ 'stores' table accessible.");
    }
}

runDiagnostics();
