/* eslint-env node */
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import crypto from 'crypto';

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

// Helper
function firestoreIdToUuid(firestoreId) {
    if (!firestoreId) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firestoreId)) {
        return firestoreId;
    }
    const hash = crypto.createHash('md5').update(firestoreId).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const toDate = (ts) => {
    if (!ts) return null;
    if (typeof ts === 'number') return new Date(ts).toISOString();
    if (typeof ts === 'string') {
        if (/^\d{10,13}$/.test(ts)) return new Date(Number(ts)).toISOString();
        return ts;
    }
    if (ts.toDate) return ts.toDate().toISOString();
    if (ts._seconds) return new Date(ts._seconds * 1000).toISOString();
    return ts;
};

async function migrateFamsData() {
    const FAMS_STORE_ID = 'tvBysnq0a75MqqyjxvzS';
    const TARGET_STORE_ID = firestoreIdToUuid(FAMS_STORE_ID); // b5b56789-...


    console.log(`🚀 Targeted Migration for FAMS PET`);
    console.log(`   Firebase Store ID: ${FAMS_STORE_ID}`);
    console.log(`   Target Supabase Store ID: ${TARGET_STORE_ID}\n`);

    // 1. Migrate Purchase Orders
    console.log("📦 Migrating Purchase Orders...");
    const poSnapshot = await db.collection('purchase_orders')
        .where('storeId', '==', FAMS_STORE_ID).get();

    for (const doc of poSnapshot.docs) {
        const d = doc.data();
        const poData = {
            id: firestoreIdToUuid(doc.id),
            store_id: TARGET_STORE_ID,
            supplier_id: firestoreIdToUuid(d.supplierId || d.supplier_id),
            supplier_name: d.supplierName || d.supplier_name || 'Unknown',
            date: toDate(d.date),
            due_date: toDate(d.dueDate || d.due_date),
            status: d.status || 'draft',
            total_amount: Number(d.totalAmount || d.total || 0),
            paid_amount: Number(d.paidAmount || d.paid || 0),
            items: d.items || [],
            note: d.notes || d.note || '',
            created_at: toDate(d.createdAt || d.created_at)
        };

        const { error } = await supabase.from('purchase_orders').upsert(poData);
        if (error) {
            console.error(`   ❌ Error on PO ${doc.id}:`, error.message);
        } else {
            console.log(`   ✅ PO ${d.supplierName || doc.id} - Rp${poData.total_amount}`);
        }
    }
    console.log(`   Total: ${poSnapshot.size} POs\n`);

    // 2. Migrate Shifts
    console.log("⏰ Migrating Shifts...");
    const shiftSnapshot = await db.collection('shifts')
        .where('storeId', '==', FAMS_STORE_ID).get();

    for (const doc of shiftSnapshot.docs) {
        const d = doc.data();
        const shiftData = {
            id: firestoreIdToUuid(doc.id),
            store_id: TARGET_STORE_ID,
            cashier_id: null, // Firebase UID not compatible
            cashier_name: d.cashierName || d.cashier_name || d.cashier || 'Unknown',
            start_time: toDate(d.startTime || d.start_time),
            end_time: toDate(d.endTime || d.end_time),
            initial_cash: Number(d.initialCash || 0),
            final_cash: Number(d.finalCash || 0),
            expected_cash: Number(d.expectedCash || 0),
            total_sales: Number(d.totalSales || 0),
            status: d.status || 'closed',
            notes: d.notes || '',
            created_at: toDate(d.createdAt || d.created_at)
        };

        const { error } = await supabase.from('shifts').upsert(shiftData);
        if (error) {
            console.error(`   ❌ Error on Shift ${doc.id}:`, error.message);
        } else {
            console.log(`   ✅ Shift ${shiftData.cashier_name} - ${shiftData.status}`);
        }
    }
    console.log(`   Total: ${shiftSnapshot.size} Shifts\n`);

    console.log("🎉 Migration Complete!");
    process.exit(0);
}

migrateFamsData().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
