
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyRLS() {
    console.log("Starting RLS Verification...");

    const tablesToVerify = ['pets', 'medical_records', 'rooms', 'subscription_plans', 'stores', 'profiles'];

    for (const table of tablesToVerify) {
        console.log(`\nChecking table: ${table}`);

        // Use an anonymous request (no auth) to check if data is leaked
        // For multitenant tables, this should return empty or error if RLS is on and no public access
        // For 'subscription_plans', we expect it to be readable due to the SELECT true policy

        const { data, error } = await supabase.from(table).select('*').limit(1);

        if (error) {
            console.log(`✅ [${table}] Error (Expected for RLS if not authorized): ${error.message}`);
        } else if (data && data.length > 0) {
            if (table === 'subscription_plans') {
                console.log(`✅ [${table}] Data accessible (Expected for public plans)`);
            } else {
                console.warn(`⚠️ [${table}] Data LEAKED! RLS might be disabled or policy is too broad.`);
            }
        } else {
            console.log(`✅ [${table}] No data returned (Expected for anon user with RLS)`);
        }
    }

    console.log("\nVerification complete.");
}

verifyRLS();
