import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    console.log("Checking for ANY kasir profile directly...");
    const { data } = await supabase.from('profiles').select('id, email, name, role').ilike('email', '%kasir%');
    console.log("Profiles matching %kasir%: ", data);

    const { data: stores } = await supabase.from('stores').select('id, name, email, owner_id').ilike('email', '%kasir%');
    console.log("Stores matching %kasir%: ", stores);

    // Create a fast RPC function to query auth.users without a proper service role key
    console.log("Creating RPC to read auth.users safely...");

}
check();
