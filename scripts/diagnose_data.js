
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jsylclofqbqdutccsrxb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeWxjbG9mcWJxZHV0Y2NzcnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTcxMTYsImV4cCI6MjA4MzQ3MzExNn0.D36mKeJ-jBaJXKQ5f0uLCHY3H31t8nB2NMRQfWrjfF8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const storeId = 'b5b56789-1960-7bd0-1f54-abee9db1ee37';
    console.log(`Checking data for store: ${storeId}`);

    // Check Products
    const { count: productCount, error: prodError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId);

    if (prodError) console.error('Product Check Error:', prodError);
    else console.log(`Products Found: ${productCount}`);

    // Check Transactions
    const { count: transCount, error: transError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId);

    if (transError) console.error('Transaction Check Error:', transError);
    else console.log(`Transactions Found: ${transCount}`);
}

checkData();
