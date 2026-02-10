-- =====================================================================================
-- EMERGENCY FIX: Restore ALL Data Access (v2)
-- This is the DEFINITIVE fix. It addresses:
-- 1. get_my_store_id() function
-- 2. ALL RLS policies on ALL tables
-- 3. ALL RPCs with SECURITY DEFINER
-- 4. Missing columns
-- 5. Proper GRANT permissions
-- =====================================================================================

-- =====================================================================================
-- STEP 0: Check and log the current state (for debugging)
-- =====================================================================================
DO $$
DECLARE
    v_count INT;
BEGIN
    -- Check if get_my_store_id exists
    SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'get_my_store_id';
    RAISE NOTICE 'get_my_store_id function count: %', v_count;
    
    -- Check profiles with store_id
    SELECT COUNT(*) INTO v_count FROM profiles WHERE store_id IS NOT NULL;
    RAISE NOTICE 'Profiles with store_id: %', v_count;
    
    -- Check profiles WITHOUT store_id
    SELECT COUNT(*) INTO v_count FROM profiles WHERE store_id IS NULL;
    RAISE NOTICE 'Profiles WITHOUT store_id: %', v_count;
END $$;

-- =====================================================================================
-- STEP 1: Missing Columns
-- =====================================================================================
ALTER TABLE shift_movements ADD COLUMN IF NOT EXISTS expense_group TEXT DEFAULT 'operational';
ALTER TABLE shift_movements ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_cash_in NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_cash_out NUMERIC(15, 2) DEFAULT 0;

-- =====================================================================================
-- STEP 2: Recreate get_my_store_id() with STABLE + SECURITY DEFINER
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.get_my_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_my_store_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_store_id() TO anon;

-- =====================================================================================
-- STEP 3: Recreate is_super_admin()
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- =====================================================================================
-- STEP 4: FIX ALL RLS POLICIES
-- The key issue: direct queries use RLS. If get_my_store_id() returns NULL,
-- no data is visible. We need to ensure policies work correctly.
-- =====================================================================================

-- 4a. Profiles: users can see own profile + same store profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS multitenant_profiles_policy ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_select_simple" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_simple" ON profiles;
DROP POLICY IF EXISTS "profiles_update_simple" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_simple" ON profiles;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON profiles;

CREATE POLICY "profiles_policy" ON profiles FOR ALL TO authenticated USING (
    id = auth.uid()
    OR store_id = get_my_store_id()
    OR is_super_admin()
);

-- 4b. Stores: owner or same store member
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS multitenant_stores_policy ON stores;
CREATE POLICY "stores_policy" ON stores FOR ALL TO authenticated USING (
    owner_id = auth.uid()
    OR id = get_my_store_id()
    OR is_super_admin()
);

-- 4c. ALL other data tables: standard multitenant policy
DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY[
        'categories', 'products', 'transactions', 'customers', 
        'point_adjustments', 'suppliers', 'sales_targets', 'promotions',
        'purchase_orders', 'shifts', 'shift_movements', 'bookings',
        'cash_flow', 'audit_logs', 'shopping_recommendations', 
        'rental_units', 'rental_sessions', 'stock_movements', 'batches',
        'stock_opname_sessions', 'loyalty_history', 'pets', 'medical_records', 'rooms'
    ];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables 
    LOOP 
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl_name) THEN
            -- Enable RLS
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl_name);
            
            -- Drop old policies
            EXECUTE format('DROP POLICY IF EXISTS multitenant_%I_policy ON %I;', tbl_name, tbl_name);
            EXECUTE format('DROP POLICY IF EXISTS "Emergency Access" ON %I;', tbl_name);
            
            -- Create new policy
            EXECUTE format('
                CREATE POLICY multitenant_%I_policy ON %I
                FOR ALL TO authenticated USING (
                    store_id = get_my_store_id() OR is_super_admin()
                );', tbl_name, tbl_name);
            
            RAISE NOTICE 'Fixed RLS policy for table: %', tbl_name;
        ELSE
            RAISE NOTICE 'Table does not exist, skipping: %', tbl_name;
        END IF;
    END LOOP;
END $$;

-- =====================================================================================
-- STEP 5: Fix get_store_initial_snapshot (SECURITY DEFINER)
-- =====================================================================================
DROP FUNCTION IF EXISTS public.get_store_initial_snapshot(UUID);
DROP FUNCTION IF EXISTS public.get_store_initial_snapshot(TEXT);
DROP FUNCTION IF EXISTS public.get_store_initial_snapshot();

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
    SELECT jsonb_agg(cat_data)
    INTO v_categories
    FROM (
        SELECT 
            c.id, c.name,
            COUNT(p.id) FILTER (WHERE p.is_deleted = false) as "productCount"
        FROM public.categories c
        LEFT JOIN public.products p ON p.category_id = c.id
        WHERE c.store_id = p_store_id
        GROUP BY c.id, c.name
        ORDER BY c.name ASC
    ) cat_data;

    SELECT jsonb_build_object(
        'totalProducts', COUNT(*) FILTER (WHERE is_deleted = false),
        'totalStock', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) ELSE 0 END),
        'totalValue', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) * COALESCE(buy_price, 0) ELSE 0 END)
    )
    INTO v_summary
    FROM public.products
    WHERE store_id = p_store_id;

    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'summary', COALESCE(v_summary, '{"totalProducts": 0, "totalStock": 0, "totalValue": 0}'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_initial_snapshot(UUID) TO authenticated;

-- =====================================================================================
-- STEP 6: Fix get_products_page (SECURITY DEFINER)
-- =====================================================================================
DROP FUNCTION IF EXISTS get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS get_products_page(TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_products_page(
    p_store_id UUID, p_page INT, p_page_size INT,
    p_search TEXT DEFAULT '', p_category TEXT DEFAULT 'all',
    p_satuan_po TEXT DEFAULT 'all', p_sort_key TEXT DEFAULT 'name',
    p_sort_dir TEXT DEFAULT 'asc'
) RETURNS JSONB 
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_offset INT; v_total BIGINT; v_products JSONB;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    SELECT COUNT(*) INTO v_total
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = p_store_id AND p.is_deleted = false
    AND (p_search = '' OR p.name ILIKE '%' || p_search || '%' OR p.barcode ILIKE '%' || p_search || '%')
    AND (p_category = 'all' OR c.name = p_category OR p.category_id::text = p_category)
    AND (p_satuan_po = 'all' OR (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR (p_satuan_po = 'no' AND p.purchase_unit IS NULL));

    SELECT jsonb_agg(row_to_json(pd)::jsonb) INTO v_products
    FROM (
        SELECT p.id, p.name, p.barcode, p.buy_price AS "buyPrice", p.sell_price AS "sellPrice",
            p.stock, c.name AS category, p.category_id AS "categoryId", p.unit,
            p.min_stock AS "minStock", p.discount, p.discount_type AS "discountType",
            p.is_unlimited AS "isUnlimited", p.purchase_unit AS "purchaseUnit",
            p.conversion_to_unit AS "conversionToUnit", p.rack_location AS "rackLocation",
            p.image_url AS "imageUrl", p.pricing_type AS "pricingType",
            p.pricing_tiers AS "pricingTiers", p.is_bundling_enabled AS "isBundlingEnabled",
            p.created_at AS "createdAt", (p.sell_price - p.buy_price) AS profit
        FROM products p LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.store_id = p_store_id AND p.is_deleted = false
        AND (p_search = '' OR p.name ILIKE '%' || p_search || '%' OR p.barcode ILIKE '%' || p_search || '%')
        AND (p_category = 'all' OR c.name = p_category OR p.category_id::text = p_category)
        AND (p_satuan_po = 'all' OR (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR (p_satuan_po = 'no' AND p.purchase_unit IS NULL))
        ORDER BY
            CASE WHEN p_sort_dir='asc' THEN CASE WHEN p_sort_key='name' THEN p.name WHEN p_sort_key='category' THEN c.name ELSE NULL END END ASC,
            CASE WHEN p_sort_dir='desc' THEN CASE WHEN p_sort_key='name' THEN p.name WHEN p_sort_key='category' THEN c.name ELSE NULL END END DESC,
            CASE WHEN p_sort_dir='asc' THEN CASE WHEN p_sort_key='stock' THEN p.stock WHEN p_sort_key='sellPrice' THEN p.sell_price WHEN p_sort_key='buyPrice' THEN p.buy_price WHEN p_sort_key='profit' THEN (p.sell_price-p.buy_price) ELSE NULL END END ASC,
            CASE WHEN p_sort_dir='desc' THEN CASE WHEN p_sort_key='stock' THEN p.stock WHEN p_sort_key='sellPrice' THEN p.sell_price WHEN p_sort_key='buyPrice' THEN p.buy_price WHEN p_sort_key='profit' THEN (p.sell_price-p.buy_price) ELSE NULL END END DESC,
            p.created_at DESC
        LIMIT p_page_size OFFSET v_offset
    ) pd;

    RETURN jsonb_build_object('data', COALESCE(v_products, '[]'::jsonb), 'total', v_total, 'page', p_page, 'pageSize', p_page_size);
END;
$$;

GRANT EXECUTE ON FUNCTION get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =====================================================================================
-- STEP 7: Fix get_dashboard_stats (SECURITY DEFINER)
-- =====================================================================================
DROP FUNCTION IF EXISTS get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_store_id UUID, p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ, p_period TEXT DEFAULT 'day'
) RETURNS JSONB 
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_total_sales NUMERIC := 0; v_total_transactions INT := 0; v_avg_order NUMERIC := 0;
    v_chart_data JSONB; v_top_products JSONB; v_recent_transactions JSONB;
BEGIN
    SELECT COALESCE(SUM(total), 0), COUNT(*), COALESCE(AVG(total), 0)
    INTO v_total_sales, v_total_transactions, v_avg_order
    FROM transactions WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date AND status IN ('completed', 'success');

    IF p_period = 'hour' THEN
        SELECT jsonb_agg(s) INTO v_chart_data FROM (
            SELECT to_char(date_trunc('hour', date), 'HH24:00') as name, SUM(total) as total
            FROM transactions WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date AND status IN ('completed', 'success')
            GROUP BY 1, EXTRACT(HOUR FROM date) ORDER BY EXTRACT(HOUR FROM date)) s;
    ELSE
        SELECT jsonb_agg(s) INTO v_chart_data FROM (
            SELECT to_char(date, 'DD Mon') as name, SUM(total) as total
            FROM transactions WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date AND status IN ('completed', 'success')
            GROUP BY 1, date_trunc('day', date) ORDER BY date_trunc('day', date)) s;
    END IF;

    SELECT jsonb_agg(t) INTO v_top_products FROM (
        SELECT item->>'name' as name, SUM((item->>'qty')::numeric) as sold, SUM((item->>'qty')::numeric * (item->>'price')::numeric) as revenue
        FROM transactions tx, jsonb_array_elements(tx.items) as item
        WHERE tx.store_id = p_store_id AND tx.date >= p_start_date AND tx.date <= p_end_date AND tx.status IN ('completed', 'success')
        GROUP BY 1 ORDER BY 3 DESC LIMIT 10) t;

    SELECT jsonb_agg(r) INTO v_recent_transactions FROM (
        SELECT id, cashier, date, total, status FROM transactions
        WHERE store_id = p_store_id AND status IN ('completed', 'success') ORDER BY date DESC LIMIT 5) r;

    RETURN jsonb_build_object(
        'totalSales', v_total_sales, 'totalTransactions', v_total_transactions, 'avgOrder', v_avg_order,
        'chartData', COALESCE(v_chart_data, '[]'::jsonb), 'categoryData', '[]'::jsonb,
        'topProducts', COALESCE(v_top_products, '[]'::jsonb), 'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- =====================================================================================
-- STEP 8: Fix get_dashboard_monthly_summary (SECURITY DEFINER)
-- =====================================================================================
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_dashboard_monthly_summary(p_store_id UUID, p_year INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
    WITH monthly_data AS (
        SELECT EXTRACT(MONTH FROM t.date)::INTEGER as month_num,
            COALESCE(SUM(t.total), 0) as total_revenue, COUNT(*) as transaction_count,
            COALESCE(SUM(t.total) - SUM(
                (SELECT COALESCE(SUM((item->>'qty')::NUMERIC * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)), 0)
                 FROM jsonb_array_elements(t.items) as item)), 0) as total_profit,
            COUNT(DISTINCT DATE(t.date)) as days_with_sales
        FROM transactions t WHERE t.store_id = p_store_id AND EXTRACT(YEAR FROM t.date) = p_year AND (t.status IS NULL OR t.status = 'completed')
        GROUP BY 1
    ),
    monthly_expenses AS (
        SELECT EXTRACT(MONTH FROM cf.date)::INTEGER as month_num, COALESCE(SUM(cf.amount), 0) as total_opex
        FROM cash_flow cf WHERE cf.store_id = p_store_id AND EXTRACT(YEAR FROM cf.date) = p_year AND cf.type = 'out' AND (cf.expense_group IS NULL OR cf.expense_group != 'asset')
        GROUP BY 1
    ),
    all_months AS (SELECT generate_series(1, 12) as month_num)
    SELECT jsonb_agg(jsonb_build_object(
        'monthIndex', am.month_num - 1,
        'name', TO_CHAR(DATE '2020-01-01' + ((am.month_num - 1) || ' month')::interval, 'Mon'),
        'totalRevenue', COALESCE(md.total_revenue, 0), 'totalProfit', COALESCE(md.total_profit, 0),
        'totalOpEx', COALESCE(me.total_opex, 0), 'transactionsCount', COALESCE(md.transaction_count, 0),
        'daysWithSales', COALESCE(md.days_with_sales, 0),
        'avgDailyRevenue', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN md.total_revenue / md.days_with_sales ELSE 0 END,
        'avgDailyProfit', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN md.total_profit / md.days_with_sales ELSE 0 END
    ) ORDER BY am.month_num) INTO v_result
    FROM all_months am LEFT JOIN monthly_data md ON md.month_num = am.month_num LEFT JOIN monthly_expenses me ON me.month_num = am.month_num;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_monthly_summary(UUID, INTEGER) TO authenticated;

-- =====================================================================================
-- STEP 9: Verify user data link (debug output)
-- =====================================================================================
DO $$
DECLARE
    v_profile RECORD;
BEGIN
    FOR v_profile IN (SELECT id, email, role, store_id FROM profiles ORDER BY created_at DESC LIMIT 5)
    LOOP
        RAISE NOTICE 'Profile: % | email: % | role: % | store_id: %', 
            v_profile.id, v_profile.email, v_profile.role, v_profile.store_id;
    END LOOP;
END $$;

-- =====================================================================================
-- STEP 10: Refresh schema cache
-- =====================================================================================
NOTIFY pgrst, 'reload schema';
