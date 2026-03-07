-- MASTER: get_store_initial_snapshot
-- Purpose: Fetch initial snapshot of a store (categories, counts, stock value)
-- Source: scripts/emergency-restore-inventory.sql (Improved version)

CREATE OR REPLACE FUNCTION public.get_store_initial_snapshot(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_categories JSONB;
    v_summary JSONB;
BEGIN
    -- 1. Fetch Categories with Product Counts
    SELECT jsonb_agg(cat_data)
    INTO v_categories
    FROM (
        SELECT 
            c.id,
            c.name,
            c.image_url as "imageUrl",
            COUNT(p.id) FILTER (WHERE p.is_deleted = false) as "productCount"
        FROM public.categories c
        LEFT JOIN public.products p ON p.category_id = c.id
        WHERE c.store_id = p_store_id
        GROUP BY c.id, c.name, c.image_url
        ORDER BY c.name ASC
    ) cat_data;

    -- 2. Fetch Summary Stats
    SELECT jsonb_build_object(
        'totalProducts', COUNT(*) FILTER (WHERE is_deleted = false),
        'totalStock', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) ELSE 0 END),
        'totalValue', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) * COALESCE(buy_price, 0) ELSE 0 END),
        'outOfStock', COUNT(*) FILTER (WHERE is_deleted = false AND stock <= 0),
        'lowStock', COUNT(*) FILTER (WHERE is_deleted = false AND stock > 0 AND stock <= COALESCE(min_stock, 10))
    )
    INTO v_summary
    FROM public.products
    WHERE store_id = p_store_id;

    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'summary', COALESCE(v_summary, '{"totalProducts":0,"totalStock":0,"totalValue":0,"outOfStock":0,"lowStock":0}'::jsonb)
    );
END;
$$;
