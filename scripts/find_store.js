
import { createClient } from '@supabase/supabase-js';

// Credentials matching existing scripts
const PROD_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const PROD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(PROD_URL, PROD_KEY);

async function findStore() {
    const email = process.argv[2];
    if (!email) {
        console.error("Please provide an email address as an argument.");
        process.exit(1);
    }

    console.log(`Searching for user: ${email}...`);

    try {
        // 1. Check Profiles
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, email')
            .eq('email', email);

        let ownerId = null;
        if (profiles && profiles.length > 0) {
            console.log(`✅ Found Profile: ${profiles[0].name} (ID: ${profiles[0].id})`);
            ownerId = profiles[0].id;
        } else {
            console.log("❌ Profile not found by email.");
        }

        if (profileError) {
            console.error("Profile search error:", profileError.message);
        }

        // 2. Search Stores (by owner_id OR by store email directly)
        let query = supabase.from('stores').select('id, name, email, owner_id, plan');

        if (ownerId) {
            // If profile found, search by owner_id OR email
            query = query.or(`owner_id.eq.${ownerId},email.eq.${email}`);
        } else {
            // Else just search by email on store table
            query = query.eq('email', email);
        }

        const { data: stores, error: storeError } = await query;

        if (storeError) {
            console.error("Store search error:", storeError.message);
            return;
        }

        if (stores && stores.length > 0) {
            console.log(`\n✅ Found ${stores.length} Store(s):`);
            stores.forEach(store => {
                console.log(`--------------------------------------------------`);
                console.log(`Store Name : ${store.name}`);
                console.log(`Store ID   : ${store.id}`); // This is what the user needs
                console.log(`Owner ID   : ${store.owner_id}`);
                console.log(`Plan       : ${store.plan}`);
                console.log(`--------------------------------------------------`);
            });
        } else {
            console.log(`\n❌ No stores found related to ${email}.`);
        }

    } catch (err) {
        console.error("Unexpected error:", err);
    }
}

findStore();
