
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

if (fs.existsSync(path.join(rootDir, '.env'))) {
    dotenv.config({ path: path.join(rootDir, '.env') });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
    console.error("❌ Need SUPABASE_SERVICE_ROLE_KEY to search users.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function findStore() {
    const email = process.argv[2];
    if (!email) {
        console.log("Usage: node find_store_by_email.js <email>");
        return;
    }

    console.log(`🔍 Searching for user: ${email}...`);

    // 1. Find User ID in Auth (Not directly possible via client usually, but we can search profiles if we have them linked)
    // Actually with Service Role we can list users (admin auth).

    // Option A: Search public.profiles or public.users table if it exists
    const { data: profiles, error: _profileError } = await supabase
        .from('users') // or profiles? Let's try 'users' table which is usually a mirror
        .select('id, email, name, store_id')
        .ilike('email', email)
        .single();

    if (profiles) {
        console.log(`✅ Found Profile!`);
        console.log(`User ID: ${profiles.id}`);
        console.log(`Store ID: ${profiles.store_id}`);
        console.log(`Name: ${profiles.name}`);
        return;
    }

    // Option B: Search stores where email might be stored (unlikely) or just iterate
    // Let's try to search auth users via admin api
    const { data: { users }, error: _authError } = await supabase.auth.admin.listUsers();

    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (user) {
        console.log(`✅ Found Auth User: ${user.id}`);

        // Now find their store
        const { data: storeLink, error: _linkError } = await supabase
            .from('users')
            .select('store_id')
            .eq('id', user.id)
            .single();

        if (storeLink) {
            console.log(`✅ Store ID found in public.users: ${storeLink.store_id}`);
        } else {
            console.log("⚠️ User found but no store_id in public.users");
        }
    } else {
        console.error("❌ User not found.");
    }
}

findStore();
