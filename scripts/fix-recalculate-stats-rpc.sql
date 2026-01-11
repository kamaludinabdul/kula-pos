-- FIX: recalculate_product_stats RPC with UUID Resilience
-- Handles both UUIDs and legacy Firebase string IDs

-- Drop the existing function (with UUID)
DROP FUNCTION IF EXISTS public.recalculate_product_stats(UUID);

CREATE OR REPLACE FUNCTION public.recalculate_product_stats(
    p_store_id TEXT -- Use TEXT to handle legacy string IDs from frontend
) RETURNS JSONB AS $$
BEGIN
    -- 1. Reset sold for all products in store
    UPDATE products 
    SET sold = 0
    WHERE store_id::TEXT = p_store_id;

    -- 2. Update based on transaction history
    -- We join products with transaction items
    WITH product_sales AS (
        SELECT 
            (item->>'id') as product_id, -- Keep as TEXT for resilience
            SUM((item->>'qty')::NUMERIC) as total_sold
        FROM transactions,
             jsonb_array_elements(items) as item
        WHERE store_id::TEXT = p_store_id AND status = 'completed'
        GROUP BY product_id
    )
    UPDATE products p
    SET sold = ps.total_sold
    FROM product_sales ps
    WHERE p.id::TEXT = ps.product_id AND p.store_id::TEXT = p_store_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
