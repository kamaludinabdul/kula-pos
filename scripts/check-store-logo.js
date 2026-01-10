
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkStoreLogo() {
    console.log("Checking store logo persistence...");

    // Get the first store (or specific one if we knew the ID, but usually there's just one or few in dev)
    const { data: stores, error } = await supabase.from('stores').select('id, name, logo');

    if (error) {
        console.error("Error fetching stores:", error.message);
        return;
    }

    if (stores && stores.length > 0) {
        stores.forEach(store => {
            console.log(`\nStore ID: ${store.id}`);
            console.log(`Name: ${store.name}`);
            if (store.logo) {
                console.log(`✅ Logo found! Length: ${store.logo.length} chars`);
                console.log(`Preview: ${store.logo.substring(0, 50)}...`);
            } else {
                console.log("❌ Logo is NULL or EMPTY.");
            }
        });
    } else {
        console.log("No stores found.");
    }
}

checkStoreLogo();
