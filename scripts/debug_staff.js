
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listProfiles() {
    console.log('Listing first 20 profiles...');

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, store_id')
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (profiles.length === 0) {
        console.log('No profiles found in public.profiles table.');
    } else {
        console.log(`Found ${profiles.length} profiles:`);
        profiles.forEach(p => {
            console.log(`- ${p.email} [${p.role}] Store: ${p.store_id}`);
        });
    }
}

listProfiles();
