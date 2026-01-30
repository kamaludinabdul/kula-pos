
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY; // Need service role to bypass RLS if needed, or just admin login

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

async function checkPlan() {
    const email = 'rhpetshop25@gmail.com';

    // 1. Get User ID
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
        console.error('Error fetching users:', userError);
        // Fallback: try to find by query if admin api fails or not available with anon key (likely fails)
        // Actually with service key it should work.
    }

    // Filter manually if listUsers doesn't support email filter directly in this version
    const user = users?.find(u => u.email === email);

    if (!user) {
        console.log('User not found via admin API. Trying public table query logic (if configured) or cannot proceed.');
        return;
    }

    console.log(`User Found: ${user.id} (${user.email})`);

    // 2. Get Stores
    const { data: stores, error: storeError } = await supabase
        .from('stores')
        .select('id, name, plan, owner_id')
        .eq('owner_id', user.id);

    if (storeError) {
        console.error('Error fetching stores:', storeError);
        return;
    }

    console.log('Stores found:', stores);

    // 3. Get Plans
    const { data: plans } = await supabase
        .from('subscription_plans')
        .select('*');

    console.log('Plans definition:', plans);
}

checkPlan();
