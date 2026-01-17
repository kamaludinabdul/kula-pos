/* eslint-env node */
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Recreate the same conversion function from migrate-data.js
function firestoreIdToUuid(firestoreId) {
    if (!firestoreId) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firestoreId)) {
        return firestoreId;
    }
    const hash = crypto.createHash('md5').update(firestoreId).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const supabaseUrl = "https://cuoayarlytvayhgyjuqb.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStoreId() {
    const FIREBASE_FAMS_STORE_ID = 'tvBysnq0a75MqqyjxvzS';
    const convertedUuid = firestoreIdToUuid(FIREBASE_FAMS_STORE_ID);
    const CORRECT_STORE_ID = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'; // User's actual store_id

    console.log(`🔄 Firebase FAMS PET ID: ${FIREBASE_FAMS_STORE_ID}`);
    console.log(`🔄 Converted UUID: ${convertedUuid}`);
    console.log(`🔄 User's current store_id: ${CORRECT_STORE_ID}`);
    console.log();

    // Check if there are records with the converted UUID
    const { data: poRecords, count: poCount } = await supabase
        .from('purchase_orders')
        .select('id', { count: 'exact' })
        .eq('store_id', convertedUuid);

    console.log(`📦 Purchase Orders with converted UUID: ${poCount || 0}`);

    const { data: custRecords, count: custCount } = await supabase
        .from('customers')
        .select('id', { count: 'exact' })
        .eq('store_id', convertedUuid);

    console.log(`👥 Customers with converted UUID: ${custCount || 0}`);

    const { data: shiftRecords, count: shiftCount } = await supabase
        .from('shifts')
        .select('id', { count: 'exact' })
        .eq('store_id', convertedUuid);

    console.log(`⏰ Shifts with converted UUID: ${shiftCount || 0}`);

    const { data: cashRecords, count: cashCount } = await supabase
        .from('cash_flow')
        .select('id', { count: 'exact' })
        .eq('store_id', convertedUuid);

    console.log(`💰 Cash Flow with converted UUID: ${cashCount || 0}`);

    // If found, update them to the correct store_id
    if ((poCount || 0) > 0 || (custCount || 0) > 0 || (shiftCount || 0) > 0) {
        console.log(`\n🔧 Updating records to use correct store_id...`);

        const { error: e1 } = await supabase.from('purchase_orders').update({ store_id: CORRECT_STORE_ID }).eq('store_id', convertedUuid);
        if (e1) console.error('  PO error:', e1.message);
        else console.log(`  ✅ Purchase Orders updated`);

        const { error: e2 } = await supabase.from('customers').update({ store_id: CORRECT_STORE_ID }).eq('store_id', convertedUuid);
        if (e2) console.error('  Customers error:', e2.message);
        else console.log(`  ✅ Customers updated`);

        const { error: e3 } = await supabase.from('shifts').update({ store_id: CORRECT_STORE_ID }).eq('store_id', convertedUuid);
        if (e3) console.error('  Shifts error:', e3.message);
        else console.log(`  ✅ Shifts updated`);

        const { error: e4 } = await supabase.from('cash_flow').update({ store_id: CORRECT_STORE_ID }).eq('store_id', convertedUuid);
        if (e4) console.error('  Cash Flow error:', e4.message);
        else console.log(`  ✅ Cash Flow updated`);

        console.log(`\n🎉 Done! Refresh the app to see your data.`);
    } else {
        console.log(`\n❌ No records found with converted UUID. Data might not have been migrated for this store.`);
    }

    process.exit(0);
}

fixStoreId().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
