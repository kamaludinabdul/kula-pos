-- EMERGENCY REPAIR: Restore Inventory Access
-- This script uses the most robust policy pattern and fixes the snapshot RPC.

BEGIN;

-- 1. Helper Functions (Ensure they exist and are secure)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_store_id()
RETURNS UUID AS $$
    SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;


-- 2. Fixed Snapshot Function
DROP FUNCTION IF EXISTS public.get_store_initial_snapshot(UUID);
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
    -- Fetch Categories with Product Counts
    SELECT jsonb_agg(cat_data)
    INTO v_categories
    FROM (
        SELECT 
            c.id,
            c.name,
            c.image_url as "imageUrl",
            COUNT(p.id) FILTER (WHERE p.is_deleted = false) as "productCount"
        FROM categories c
        LEFT JOIN products p ON p.category_id = c.id
        WHERE c.store_id = p_store_id
        GROUP BY c.id, c.name, c.image_url
        ORDER BY c.name ASC
    ) cat_data;

    -- Fetch Summary Stats
    SELECT jsonb_build_object(
        'totalProducts', COUNT(*) FILTER (WHERE is_deleted = false),
        'totalStock', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) ELSE 0 END),
        'totalValue', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) * COALESCE(buy_price, 0) ELSE 0 END)
    )
    INTO v_summary
    FROM products
    WHERE store_id = p_store_id;

    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'summary', COALESCE(v_summary, '{"totalProducts": 0, "totalStock": 0, "totalValue": 0}'::jsonb)
    );
END;
$$;


-- 3. Robust RLS Policies
-- We drop ALL possible conflicting policies first.

DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY['categories', 'products', 'stock_movements', 'stock_opname_sessions'];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables 
    LOOP 
        -- Clean up ALL known policy names
        EXECUTE format('DROP POLICY IF EXISTS "authenticated_select_all" ON %I;', tbl_name);
        EXECUTE format('DROP POLICY IF EXISTS "multitenant_%I_policy" ON %I;', tbl_name, tbl_name);
        EXECUTE format('DROP POLICY IF EXISTS "Users can view their store %I" ON %I;', tbl_name, tbl_name);
        
        -- Create the most robust policy: simple equality with SECURITY DEFINER helper
        EXECUTE format('
            CREATE POLICY multitenant_%I_policy ON %I
            FOR ALL TO authenticated
            USING (
                store_id = get_my_store_id() OR is_super_admin()
            )
            WITH CHECK (
                store_id = get_my_store_id() OR is_super_admin()
            );', tbl_name, tbl_name);
            
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl_name);
    END LOOP;
END $$;

COMMIT;
