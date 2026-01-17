/* eslint-env node */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Firebase
const serviceAccount = JSON.parse(
    readFileSync('./scripts/serviceAccountKey.json', 'utf8')
);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function checkFamsData() {
    const FAMS_STORE_ID = 'tvBysnq0a75MqqyjxvzS';

    console.log(`🔍 Checking FAMS PET (${FAMS_STORE_ID}) data in Firebase...\n`);

    // Purchase Orders
    const poSnapshot = await db.collection('purchase_orders')
        .where('storeId', '==', FAMS_STORE_ID).get();
    console.log(`📦 Purchase Orders: ${poSnapshot.size} records`);
    if (poSnapshot.size > 0) {
        poSnapshot.docs.slice(0, 3).forEach(doc => {
            const d = doc.data();
            console.log(`   - ${d.supplierName || 'Unknown'}: Rp${d.totalAmount || d.total || 0}`);
        });
    }

    // Also check with store_id (snake_case)
    const poSnapshot2 = await db.collection('purchase_orders')
        .where('store_id', '==', FAMS_STORE_ID).get();
    console.log(`📦 Purchase Orders (store_id): ${poSnapshot2.size} records`);

    // Customers
    const custSnapshot = await db.collection('customers')
        .where('storeId', '==', FAMS_STORE_ID).get();
    console.log(`\n👥 Customers: ${custSnapshot.size} records`);
    if (custSnapshot.size > 0) {
        custSnapshot.docs.slice(0, 3).forEach(doc => {
            const d = doc.data();
            console.log(`   - ${d.name || 'Unknown'}`);
        });
    }

    // Also check with store_id (snake_case)
    const custSnapshot2 = await db.collection('customers')
        .where('store_id', '==', FAMS_STORE_ID).get();
    console.log(`👥 Customers (store_id): ${custSnapshot2.size} records`);

    // Shifts
    const shiftSnapshot = await db.collection('shifts')
        .where('storeId', '==', FAMS_STORE_ID).get();
    console.log(`\n⏰ Shifts: ${shiftSnapshot.size} records`);

    const shiftSnapshot2 = await db.collection('shifts')
        .where('store_id', '==', FAMS_STORE_ID).get();
    console.log(`⏰ Shifts (store_id): ${shiftSnapshot2.size} records`);

    // Transactions (to compare with what IS working)
    const txSnapshot = await db.collection('transactions')
        .where('storeId', '==', FAMS_STORE_ID).get();
    console.log(`\n💳 Transactions: ${txSnapshot.size} records`);

    // Products
    const prodSnapshot = await db.collection('products')
        .where('storeId', '==', FAMS_STORE_ID).get();
    console.log(`📦 Products: ${prodSnapshot.size} records`);

    console.log("\n✅ Done!");
    process.exit(0);
}

checkFamsData().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
