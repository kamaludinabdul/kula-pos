import { supabase } from './src/supabase.js';

async function test() {
    console.log("Testing get_transactions_report_stats...");
    let res1 = await supabase.rpc('get_transactions_report_stats', {
        p_store_id: 'store-id-here',
        p_start_date: new Date().toISOString(),
        p_end_date: new Date().toISOString(),
        p_status_filter: 'all',
        p_payment_method_filter: 'all',
        p_stock_type_filter: 'all'
    });
    console.log(res1);

    console.log("Testing get_transactions_page...");
    let res2 = await supabase.rpc('get_transactions_page', {
        p_store_id: 'store-id-here',
        p_start_date: new Date().toISOString(),
        p_end_date: new Date().toISOString(),
        p_search: '',
        p_status_filter: 'all',
        p_payment_method_filter: 'all',
        p_stock_type_filter: 'all',
        p_page: 1,
        p_page_size: 20
    });
    console.log(res2);
}
test();
