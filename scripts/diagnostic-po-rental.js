/* eslint-env node */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import crypto from 'crypto';

const serviceAccount = JSON.parse(
    readFileSync('./scripts/kula-pos-staging-firebase-adminsdk-fbsvc-7bec409b0a.json', 'utf8')
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

function firestoreIdToUuid(firestoreId) {
    if (!firestoreId) return null;
    const hash = crypto.createHash('sha1').update(firestoreId).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
}

async function diagnostic() {
    console.log("--- PO Diagnostic ---");
    const poSnapshot = await db.collection('purchase_orders').get();
    for (const doc of poSnapshot.docs) {
        const data = doc.data();
        const storeId = data.storeId || data.store_id;
        console.log(`PO ID: ${doc.id}, StoreId: ${storeId}, StoreUUID: ${firestoreIdToUuid(storeId)}`);
    }

    console.log("\n--- Rental Diagnostic ---");
    const units = await db.collection('rental_units').get();
    console.log(`Rental Units: ${units.size}`);
    const sessions = await db.collection('rental_sessions').get();
    console.log(`Rental Sessions: ${sessions.size}`);

    process.exit(0);
}

diagnostic();
