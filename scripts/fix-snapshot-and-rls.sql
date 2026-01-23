-- Create or Replace get_store_initial_snapshot with SECURITY DEFINER
-- This ensures the function can calculate counts even if RLS is strict on the products table.

DROP FUNCTION IF EXISTS get_store_initial_snapshot(UUID);

CREATE OR REPLACE FUNCTION get_store_initial_snapshot(p_store_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Essential to bypass RLS for internal counts
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
            COUNT(p.id) as "productCount"
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id AND p.is_deleted = false
        WHERE c.store_id = p_store_id
        GROUP BY c.id, c.name, c.image_url
        ORDER BY c.name ASC
    ) cat_data;

    -- 2. Fetch Basic Stats for Dashboard/Summary
    SELECT jsonb_build_object(
        'totalProducts', COUNT(*),
        'totalStock', SUM(COALESCE(stock, 0)),
        'totalValue', SUM(COALESCE(stock, 0) * COALESCE(buy_price, 0))
    )
    INTO v_summary
    FROM products
    WHERE store_id = p_store_id AND is_deleted = false;

    -- 3. Return combined result
    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'summary', COALESCE(v_summary, '{"totalProducts": 0, "totalStock": 0, "totalValue": 0}'::jsonb)
    );
END;
$$;

-- Also Ensure RLS is enabled and set correctly for direct access
-- Sometimes a simple 'true' policy for authenticated users is safer during debugging
DROP POLICY IF EXISTS "authenticated_select_all" ON products;
CREATE POLICY "authenticated_select_all" ON products
FOR SELECT TO authenticated USING (store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "authenticated_select_all" ON categories;
CREATE POLICY "authenticated_select_all" ON categories
FOR SELECT TO authenticated USING (store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid()));

-- Re-enable RLS just in case
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
