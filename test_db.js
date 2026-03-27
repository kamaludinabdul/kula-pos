import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
    const { data: tx } = await supabase.from('transactions').select('store_id').limit(1);
    if (!tx || !tx.length) return console.log("No txs");
    
    console.log("Store ID:", tx[0].store_id);
    const { data, error } = await supabase.rpc('get_transactions_report_stats', {
        p_store_id: tx[0].store_id, 
        p_start_date: '2026-02-01T00:00:00Z',
        p_end_date: '2026-03-31T23:59:59Z',
        p_status_filter: 'all',
        p_payment_method_filter: 'all',
        p_stock_type_filter: 'all'
    });
    console.log("Stats Data:", data);
    console.log("Stats Error:", error);

    const { data: td, error: te } = await supabase.rpc('get_transactions_page', {
        p_store_id: tx[0].store_id, 
        p_start_date: '2026-02-01T00:00:00Z',
        p_end_date: '2026-03-31T23:59:59Z',
        p_search: '',
        p_status_filter: 'all',
        p_payment_method_filter: 'all',
        p_stock_type_filter: 'all',
        p_page: 1,
        p_page_size: 20
    });
    console.log("Page Error:", te);
    if (td) console.log("Page Total:", td.total, "Rows:", td.data?.length);
}

test();
