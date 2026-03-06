import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testAdjustStock() {
    console.log("Testing adjust_stock...");

    // First, get a valid store and product
    const { data: products, error: prodErr } = await supabase.from('products').select('id, store_id, name').limit(1);
    if (prodErr || !products || products.length === 0) {
        console.error("Failed to fetch product:", prodErr);
        return;
    }

    const product = products[0];
    console.log("Using product:", product);

    const { data, error } = await supabase.rpc('adjust_stock', {
        p_store_id: product.store_id,
        p_product_id: product.id,
        p_qty_change: 1,
        p_type: 'in',
        p_note: 'Test add stock'
    });

    if (error) {
        console.error("RPC Error:", error);
    } else {
        console.log("RPC Result:", data);

        // Let's also test add_stock_batch if it exists
        const { data: batchData, error: batchErr } = await supabase.rpc('add_stock_batch', {
            p_store_id: product.store_id,
            p_product_id: product.id,
            p_qty: 1,
            p_buy_price: 1000,
            p_date: new Date().toISOString().split('T')[0]
        });

        if (batchErr) {
            console.error("Batch RPC Error:", batchErr);
        } else {
            console.log("Batch RPC Result:", batchData);
        }
    }
}

testAdjustStock();
