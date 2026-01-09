/* eslint-env node */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
    readFileSync('./scripts/kula-pos-staging-firebase-adminsdk-fbsvc-7bec409b0a.json', 'utf8')
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function diagnostic() {
    const collections = [
        'products',
        'categories',
        'purchase_orders',
        'rental_units',
        'rental_sessions',
        'bookings'
    ];

    console.log("--- Firestore Diagnostic ---");
    for (const collName of collections) {
        const snapshot = await db.collection(collName).get();
        console.log(`Collection [${collName}]: ${snapshot.size} documents`);
        if (snapshot.size > 0) {
            const firstDoc = snapshot.docs[0].data();
            console.log(`Sample [${collName}] keys:`, Object.keys(firstDoc));
            if (collName === 'products') {
                // const hasCategoryId = snapshot.docs.some(d => d.data().categoryId || d.data().category_id);
                console.log(`Products with category link: ${snapshot.docs.filter(d => d.data().categoryId || d.data().category_id).length}`);
            }
        }
    }
    process.exit(0);
}

diagnostic();
