const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkUser() {
    console.log("Checking user profile for kamaludinabdulbasit@gmail.com...");

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'kamaludinabdulbasit@gmail.com')
        .single();

    if (error) {
        console.error("Error fetching profile:", error);
        return;
    }

    console.log("Profile Data:", data);

    console.log("\nChecking RLS Status for transactions...");
    const { data: rlsData, error: rlsError } = await supabase.rpc('check_rls_status', { table_name: 'transactions' });
    // Note: check_rls_status might not exist, but let's try direct query if possible or just rely on console.

    if (rlsError) {
        console.log("check_rls_status RPC failed (likely doesn't exist), checking policies via query...");
    }
}

checkUser();
