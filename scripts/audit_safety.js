import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function auditSafety() {
    console.log('--- SAFETY AUDIT START ---');

    // 1. Check for stores without owner_id
    const { count: noOwnerCount } = await supabase
        .from('stores')
        .select('id, name, email', { count: 'exact' })
        .is('owner_id', null);

    console.log(`Stores without owner_id: ${noOwnerCount || 0}`);

    // 2. Check for stores where owner_id exists but profile is missing
    const { data: storesWithProfiles, error: profileError } = await supabase
        .from('stores')
        .select(`
            id, name, owner_id, 
            owner:profiles!stores_owner_id_fkey (id)
        `);

    if (profileError) {
        console.error('Error fetching profiles:', profileError.message);
    } else {
        const brokenProfiles = storesWithProfiles?.filter(s => s.owner_id && !s.owner) || [];
        console.log(`Stores with broken owner_id links (missing profiles): ${brokenProfiles.length}`);
    }

    // 3. Check for plan mismatches
    const { data: mismatchData, error: mismatchError } = await supabase
        .from('stores')
        .select(`
            id, name, plan, 
            owner:profiles!stores_owner_id_fkey (id, plan)
        `);

    if (mismatchError) {
        console.error('Error fetching mismatches:', mismatchError.message);
    } else {
        const mismatches = mismatchData?.filter(s => s.owner && s.plan !== s.owner.plan) || [];
        console.log(`Plan mismatches (Store vs Owner): ${mismatches.length}`);
        if (mismatches.length > 0) {
            console.log('Sample mismatches:');
            mismatches.slice(0, 5).forEach(m => {
                console.log(`- ${m.name}: Store=${m.plan} | Owner=${m.owner.plan}`);
            });
        }
    }

    console.log('--- SAFETY AUDIT END ---');
}

auditSafety();
