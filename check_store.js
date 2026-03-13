import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from the project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Force service role if it exists, otherwise it will fail to read auth.users
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Service Role Key in .env. Skipping auth.users check.");
}

const supabase = createClient(supabaseUrl, supabaseKey || process.env.VITE_SUPABASE_ANON_KEY);

async function checkStore() {
    const email = 'kasirfamspet@gmail.com';

    console.log(`Checking accounts for: ${email}`);

    // 1. Check auth.users (if using service_role key)
    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (!error && users) {
            const user = users.find(u => u.email === email);
            if (user) {
                console.log('✅ Found in auth.users:', user.id, '| Role:', user.user_metadata?.role, '| Store Name:', user.user_metadata?.store_name);
            } else {
                console.log('❌ NOT found in auth.users');
            }
        } else {
            console.log('❌ Error fetching auth.users', error);
        }
    } catch (e) {
        console.log('Could not check auth.users (requires service_role key)', e.message);
    }

    // 2. Check public.profiles
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single();
    if (profile) {
        console.log('✅ Found in public.profiles:', profile.id, '| Store ID:', profile.store_id);
    } else {
        console.log('❌ NOT found in public.profiles');
    }

    // 3. Check public.stores
    const { data: stores } = await supabase.from('stores').select('id, name, owner_id, email, business_type').eq('email', email);
    if (stores && stores.length > 0) {
        console.log(`✅ Found ${stores.length} store(s) in public.stores:`);
        console.table(stores);
    } else {
        console.log('❌ NOT found in public.stores (by email)');

        // Check by owner_id if we found a profile
        if (profile) {
            const { data: storesById } = await supabase.from('stores').select('id, name, owner_id, email, business_type').eq('owner_id', profile.id);
            if (storesById && storesById.length > 0) {
                console.log(`✅ Found store by owner_id instead!`);
                console.table(storesById);
            }
        }
    }

    console.log('Done.');
}

checkStore();
