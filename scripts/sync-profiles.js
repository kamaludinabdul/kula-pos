/* eslint-env node */
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const SUPABASE_URL = "https://cuoayarlytvayhgyjuqb.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2F5YXJseXR2YXloZ3lqdXFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5NjE4OSwiZXhwIjoyMDgzNDcyMTg5fQ.F2SHELyhdx0ejHpiunyAG6Ta9xzF-sWOkw13p1ey3RY";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function syncProfiles() {
    console.log("🔄 Syncing profiles from auth.users...\n");

    // 1. Get all users from Auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
        console.error("❌ Failed to fetch auth users:", authError);
        return;
    }
    console.log(`Found ${users.length} users in auth.users`);

    // 2. Get all stores to link owner
    const { data: stores } = await supabase.from('stores').select('id, owner_id, email');
    console.log(`Found ${stores?.length || 0} stores\n`);

    let created = 0, skipped = 0, errors = 0;

    for (const user of users) {
        // Check if profile exists
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .single();

        if (existing) {
            console.log(`⏭️  Profile exists: ${user.email}`);
            skipped++;
            continue;
        }

        // Find matching store (by owner_id or email)
        const matchingStore = stores?.find(s =>
            s.owner_id === user.id ||
            s.email === user.email
        );

        const storeId = matchingStore?.id || null;

        // Create profile
        const { error: insertError } = await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            role: storeId ? 'owner' : 'staff', // Owner if has store, else staff
            store_id: storeId,
            status: 'offline',
            permissions: [],
            created_at: user.created_at
        });

        if (insertError) {
            console.error(`❌ Error creating profile for ${user.email}:`, insertError.message);
            errors++;
        } else {
            console.log(`✅ Created profile: ${user.email} (store: ${storeId ? 'linked' : 'none'})`);
            created++;
        }
    }

    console.log(`\n🎉 Sync Complete! Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
}

syncProfiles().catch(console.error);
