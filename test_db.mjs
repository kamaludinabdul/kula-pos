import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
    console.log("Testing RPC...");
    const { data, error } = await supabase.rpc('get_transactions_report_stats', {
        p_store_id: 'ebca7067-124b-4682-96db-5a1a120b6d27', // Adjust this
        p_start_date: '2026-02-01T00:00:00Z',
        p_end_date: '2026-02-28T23:59:59Z',
        p_status_filter: 'all',
        p_payment_method_filter: 'all',
        p_stock_type_filter: 'all'
    });
    console.log("Data:", data);
    console.log("Error:", error);
}

test();
