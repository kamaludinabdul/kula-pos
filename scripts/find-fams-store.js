/* eslint-env node */
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Firebase
const serviceAccount = JSON.parse(
    readFileSync('./scripts/serviceAccountKey.json', 'utf8')
);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Supabase
const supabaseUrl = "https://cuoayarlytvayhgyjuqb.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findFamsStore() {
    console.log("🔍 Searching for FAMS PET store...\n");

    // 1. Search in Firebase stores
    const storesSnapshot = await db.collection('stores').get();
    let famsStoreId = null;

    console.log("📦 Stores in Firebase:");
    storesSnapshot.forEach(doc => {
        const data = doc.data();
        const name = data.name || 'Unnamed';
        console.log(`  - ${doc.id}: ${name}`);
        if (name.toLowerCase().includes('fams')) {
            famsStoreId = doc.id;
            console.log(`    ^^^ FOUND FAMS!`);
        }
    });

    if (!famsStoreId) {
        console.log("\n❌ FAMS store not found in Firebase stores collection.");
        console.log("   Searching in purchase_orders for any store references...\n");

        // Search PO for clues
        const poSnapshot = await db.collection('purchase_orders').limit(5).get();
        console.log(`📦 Sample Purchase Orders (${poSnapshot.size}):`);
        poSnapshot.forEach(doc => {
            const data = doc.data();
            console.log(`  - ID: ${doc.id}, Store: ${data.storeId || data.store_id}, Supplier: ${data.supplierName}`);
        });
    }

    // 2. Check what store_id is used by products that ARE in Supabase
    console.log("\n🔍 Checking products in Supabase for store_id...");
    const { data: products } = await supabase
        .from('products')
        .select('id, name, store_id')
        .limit(5);

    if (products?.length > 0) {
        console.log("Sample products:");
        products.forEach(p => console.log(`  - ${p.name}: store_id = ${p.store_id}`));

        const productStoreId = products[0].store_id;
        console.log(`\n✅ Products are using store_id: ${productStoreId}`);

        // 3. Check if this matches user's profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, store_id, email')
            .eq('email', 'rhpetshop25@gmail.com')
            .single();

        console.log(`\n👤 User's store_id: ${profile?.store_id}`);

        if (profile?.store_id !== productStoreId) {
            console.log("\n⚠️ MISMATCH! User's store_id doesn't match products' store_id.");
            console.log("   SOLUTION: Update user's profile to use the same store_id as products.");
            console.log(`\n   Run this SQL in Supabase:\n`);
            console.log(`   UPDATE profiles SET store_id = '${productStoreId}' WHERE email = 'rhpetshop25@gmail.com';`);
        }
    }

    process.exit(0);
}

findFamsStore().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
