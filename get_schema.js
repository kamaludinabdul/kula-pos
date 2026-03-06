require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function getSchema() {
    const { data, error } = await supabase.from('batches').select('*').limit(1);
    console.log(data, error);
}
getSchema();
