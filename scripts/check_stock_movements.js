import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function checkStockMovements() {
    const { data, error, count } = await supabaseAdmin.from('stock_movements').select('*', { count: 'exact', head: true });
    console.log('Error:', error);
    console.log('Total Count:', count);

    const { data: rows } = await supabaseAdmin.from('stock_movements').select('*').limit(5);
    console.log('Sample Rows:', rows);
}

checkStockMovements();
