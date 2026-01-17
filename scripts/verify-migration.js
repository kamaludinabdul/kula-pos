/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://cuoayarlytvayhgyjuqb.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "sb_secret_bj-pEjD5QgXsx5jB60F49w_ZBChpMMc";

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log("🔍 Verifying migrated data...\n");

    // 1. Check Purchase Orders
    const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select('id, store_id, supplier_name, status, total_amount')
        .limit(10);

    console.log("📦 Purchase Orders:", purchaseOrders?.length || 0, "records");
    if (poError) console.error("  Error:", poError.message);
    if (purchaseOrders?.length > 0) {
        console.log("  Sample store_ids:", [...new Set(purchaseOrders.map(p => p.store_id))]);
    }

    // 2. Check Customers
    const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, name, store_id')
        .limit(10);

    console.log("\n👥 Customers:", customers?.length || 0, "records");
    if (custError) console.error("  Error:", custError.message);
    if (customers?.length > 0) {
        console.log("  Sample store_ids:", [...new Set(customers.map(c => c.store_id))]);
    }

    // 3. Check Shifts
    const { data: shifts, error: shiftError } = await supabase
        .from('shifts')
        .select('id, store_id, cashier_name, status')
        .limit(10);

    console.log("\n⏰ Shifts:", shifts?.length || 0, "records");
    if (shiftError) console.error("  Error:", shiftError.message);
    if (shifts?.length > 0) {
        console.log("  Sample store_ids:", [...new Set(shifts.map(s => s.store_id))]);
    }

    // 4. Check user's current store
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, store_id, name')
        .eq('email', 'rhpetshop25@gmail.com')
        .single();

    console.log("\n👤 User Profile (rhpetshop25@gmail.com):");
    console.log("  Store ID:", profile?.store_id);
    console.log("  Name:", profile?.name);

    // 5. Check all stores
    const { data: stores } = await supabase
        .from('stores')
        .select('id, name')
        .limit(5);

    console.log("\n🏪 Available Stores:");
    stores?.forEach(s => console.log(`  - ${s.id}: ${s.name}`));

    console.log("\n✅ Verification complete!");
}

verify().catch(console.error);
