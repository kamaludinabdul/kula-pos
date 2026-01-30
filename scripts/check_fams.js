import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function checkFamsPet() {
    console.log('--- FAMS PET CHECK ---');
    const { data: stores, error } = await supabase
        .from('stores')
        .select(`
            id, name, plan, owner_id,
            owner:profiles!stores_owner_id_fkey (id, email, plan)
        `)
        .ilike('name', '%FAMS PET%');

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${stores?.length || 0} stores matching FAMS PET:`);
        stores?.forEach(s => {
            console.log(`- [${s.id}] ${s.name}: Store=${s.plan} | Owner=${s.owner?.plan || 'N/A'}`);
        });
    }
}

checkFamsPet();
