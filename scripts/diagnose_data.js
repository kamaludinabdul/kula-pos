
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log("Fetching all stores...");
    const { data: stores, error: storesErr } = await supabase.from('stores').select('*');
    if (storesErr) {
        console.error("Error fetching stores:", storesErr.message);
        return;
    }
    console.log(`Found ${stores.length} stores.`);

    const ownerIds = [...new Set(stores.map(s => s.owner_id).filter(id => id))];
    console.log("Owner IDs to check:", ownerIds);

    if (ownerIds.length === 0) {
        console.log("No owner_ids found in stores.");
        return;
    }

    console.log("\nFetching profiles for those owner IDs...");
    const { data: profiles, error: profilesErr } = await supabase.from('profiles').select('*').in('id', ownerIds);
    if (profilesErr) {
        console.error("Error fetching profiles:", profilesErr.message);
        return;
    }
    console.log(`Found ${profiles.length} profiles.`);

    console.log("\nReviewing matched Owner/Store data:");
    stores.forEach(s => {
        const owner = profiles.find(p => p.id === s.owner_id);
        console.log(`- Store: ${s.name}`);
        console.log(`  Owner ID: ${s.owner_id}`);
        if (owner) {
            console.log(`  Matched Profile: ${owner.name} (${owner.email})`);
            console.log(`  Profile Plan: ${owner.plan}`);
        } else {
            console.log(`  MATCH FAILED: No profile found for this owner_id`);
        }
        console.log(`  Store Column Plan: ${s.plan}`);
    });
}

diagnose();
