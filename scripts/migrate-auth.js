/* eslint-env node */
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import crypto from 'crypto';

// --- CONFIGURATION ---
// 1. Path to your Firebase Prod Service Account
const serviceAccountPath = './scripts/serviceAccountKey.json';

// 2. Supabase Production Config
const SUPABASE_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "YOUR_SERVICE_ROLE_KEY";

// --- SETUP ---
if (!SUPABASE_URL.includes("http")) {
    console.error("❌ Please configure SUPABASE_URL and SUPABASE_SERVICE_KEY in the script!");
    process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Deterministic UUID Helper (MUST MATCH migrate-data.js)
function firestoreIdToUuid(firestoreId) {
    if (!firestoreId) return null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(firestoreId)) {
        return firestoreId;
    }
    const hash = crypto.createHash('md5').update(firestoreId).digest('hex');
    const uuid = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
    return uuid;
}

async function migrateUsers() {
    console.log("🚀 Starting Auth Migration...");

    let nextPageToken;
    let successCount = 0;
    let errorCount = 0;

    do {
        const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);

        for (const user of listUsersResult.users) {
            const supabaseUid = firestoreIdToUuid(user.uid);
            console.log(`Processing ${user.email} (${user.uid}) -> ${supabaseUid}`);

            try {
                // Try to create user
                const { data: _data, error } = await supabase.auth.admin.createUser({
                    id: supabaseUid, // Force ID to match our deterministic map
                    email: user.email,
                    password: 'TemporaryPassword123!', // Users MUST reset this
                    email_confirm: true,
                    user_metadata: {
                        name: user.displayName || '',
                        firebase_uid: user.uid
                    }
                });

                if (error) {
                    // If user already exists, just log
                    if (error.message.includes("already has been registered")) {
                        console.log(`   ℹ️  User available: ${user.email}`);
                        successCount++; // Count as success
                    } else {
                        throw error;
                    }
                } else {
                    console.log(`   ✅ Created: ${user.email}`);
                    successCount++;
                }

            } catch (err) {
                console.error(`   ❌ Error creating ${user.email}:`, err.message);
                errorCount++;
            }
        }

        nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`\n🎉 Migration Complete! Success: ${successCount}, Errors: ${errorCount}`);
    console.log(`⚠️  NOTE: All users were given 'TemporaryPassword123!'. Ask them to use 'Forgot Password' or you update it.`);
}

migrateUsers().catch(console.error);
