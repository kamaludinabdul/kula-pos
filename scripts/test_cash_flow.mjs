import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
    console.log("Checking cash_flow table schema via simple fetch...");
    // Let's try to insert a dummy record to see the exact error
    const { data, error } = await supabase.from('cash_flow').insert({
        store_id: '00000000-0000-0000-0000-000000000000',
        type: 'out',
        category: 'Pemusnahan Stok',
        expense_group: 'write_off',
        amount: 0,
        description: 'Test',
        date: '2026-03-06',
        performed_by: 'Staff'
    }).select();

    if (error) {
        console.error("Insert Error details:", JSON.stringify(error, null, 2));
    } else {
        console.log("Insert Success!", data);
    }
}

checkSchema();
