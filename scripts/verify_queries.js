
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

async function testQueries() {
    console.log("Testing fetchStores query...");

    // Test 1: DataContext join syntax
    console.log("\n--- Test 1: DataContext syntax (owner:profiles!owner_id) ---");
    const test1 = await supabase
        .from('stores')
        .select(`
            *,
            owner:profiles!owner_id (
                id, name, email, plan, plan_expiry_date
            )
        `)
        .limit(1);

    if (test1.error) {
        console.error("Test 1 FAILED:", test1.error.message);
    } else {
        console.log("Test 1 SUCCESS");
    }

    // Test 2: Simplified join syntax
    console.log("\n--- Test 2: Simplified syntax (profiles!owner_id) ---");
    const test2 = await supabase
        .from('stores')
        .select(`
            *,
            profiles!owner_id (
                id, name, email, plan, plan_expiry_date
            )
        `)
        .limit(1);

    if (test2.error) {
        console.error("Test 2 FAILED:", test2.error.message);
    } else {
        console.log("Test 2 SUCCESS");
    }

    // Test 3: Join without column hint if only one FK exists
    console.log("\n--- Test 3: Standard syntax (profiles) ---");
    const test3 = await supabase
        .from('stores')
        .select(`
            *,
            profiles (
                id, name, email, plan, plan_expiry_date
            )
        `)
        .limit(1);

    if (test3.error) {
        console.error("Test 3 FAILED:", test3.error.message);
    } else {
        console.log("Test 3 SUCCESS");
    }

    // Test 4: SubscriptionApproval syntax
    console.log("\n--- Test 4: SubscriptionApproval syntax ---");
    const test4 = await supabase
        .from('subscription_invoices')
        .select(`
            *,
            stores:store_id (
                name,
                email,
                owner:profiles (
                    name,
                    email
                )
            )
        `)
        .limit(1);

    if (test4.error) {
        console.error("Test 4 FAILED:", test4.error.message);
    } else {
        console.log("Test 4 SUCCESS");
    }
}

testQueries();
