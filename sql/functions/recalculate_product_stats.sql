-- MASTER: recalculate_product_stats
-- Purpose: Sync sold and revenue stats for all products based on transaction history
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.recalculate_product_stats(
    p_store_id UUID
) RETURNS JSONB AS $$
BEGIN
    -- 1. Reset sold and revenue for all products in store
    UPDATE products 
    SET sold = 0
    WHERE store_id = p_store_id;

    -- 2. Update based on transaction history
    WITH product_sales AS (
        SELECT 
            (item->>'id')::UUID as product_id,
            SUM((item->>'qty')::NUMERIC) as total_sold
        FROM transactions,
             jsonb_array_elements(items) as item
        WHERE store_id = p_store_id AND status = 'completed'
        GROUP BY product_id
    )
    UPDATE products p
    SET sold = ps.total_sold
    FROM product_sales ps
    WHERE p.id = ps.product_id AND p.store_id = p_store_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
