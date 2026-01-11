-- FIX: get_product_sales_report RPC with UUID Resilience
-- Handles both UUIDs and legacy Firebase string IDs

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_product_sales_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_product_sales_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    product_id TEXT, -- Use TEXT to handle legacy non-UUID IDs
    product_name TEXT,
    category_name TEXT,
    total_qty NUMERIC,
    total_revenue NUMERIC,
    total_cogs NUMERIC,
    total_profit NUMERIC,
    transaction_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH sale_items AS (
        SELECT 
            t.id as trans_id,
            (item->>'id') as p_id, -- Keep as TEXT for resilience
            (item->>'name') as p_name,
            COALESCE((item->>'qty')::NUMERIC, 0) as q,
            COALESCE((item->>'price')::NUMERIC, 0) as p,
            COALESCE((item->>'buyPrice')::NUMERIC, 0) as c
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id
          AND t.date >= p_start_date
          AND t.date <= p_end_date
          AND t.status = 'completed'
    )
    SELECT 
        s.p_id as product_id,
        s.p_name as product_name,
        COALESCE(cat.name, 'Tanpa Kategori') as category_name,
        SUM(s.q) as t_qty,
        SUM(s.q * s.p) as t_revenue,
        SUM(s.q * s.c) as t_cogs,
        SUM(s.q * (s.p - s.c)) as t_profit,
        COUNT(DISTINCT s.trans_id) as transaction_count
    FROM sale_items s
    LEFT JOIN products pr ON s.p_id = pr.id::TEXT -- Match using string comparison for mixed IDs
    LEFT JOIN categories cat ON pr.category_id = cat.id
    GROUP BY s.p_id, s.p_name, cat.name;
END;
$$;

-- Refresh cache
NOTIFY pgrst, 'reload schema';
