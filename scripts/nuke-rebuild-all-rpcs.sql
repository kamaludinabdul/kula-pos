-- =====================================================================================
-- NUKE & REBUILD: Fix HTTP 300 (Multiple Choices) Error
-- Problem: Multiple function signatures exist (TEXT and UUID versions)
-- Solution: Drop ALL versions, create ONE definitive version
-- =====================================================================================

-- =====================================================================================
-- STEP 1: NUKE ALL versions of get_dashboard_stats
-- =====================================================================================
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TEXT, TEXT, TEXT);

-- Also nuke get_store_initial_snapshot (might have same issue)
DROP FUNCTION IF EXISTS public.get_store_initial_snapshot(UUID);
DROP FUNCTION IF EXISTS public.get_store_initial_snapshot(TEXT);
DROP FUNCTION IF EXISTS public.get_store_initial_snapshot();

-- Also nuke get_products_page
DROP FUNCTION IF EXISTS public.get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_products_page(TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- Also nuke get_dashboard_monthly_summary
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(TEXT, INTEGER);

-- =====================================================================================
-- STEP 2: Recreate get_dashboard_stats (ONE version only - UUID)
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day'
) RETURNS JSONB 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_transactions INT := 0;
    v_avg_order NUMERIC := 0;
    v_chart_data JSONB;
    v_category_stats JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
BEGIN
    -- 1. General Stats - relaxed status filter
    SELECT 
        COALESCE(SUM(total), 0), COUNT(*), COALESCE(AVG(total), 0)
    INTO v_total_sales, v_total_transactions, v_avg_order
    FROM transactions
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date
      AND (status IS NULL OR status IN ('completed', 'success', 'paid'));

    -- 2. Chart Data
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT to_char(date_trunc('hour', date), 'HH24:00') as name, SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date
              AND (status IS NULL OR status IN ('completed', 'success', 'paid'))
            GROUP BY 1, EXTRACT(HOUR FROM date)
            ORDER BY EXTRACT(HOUR FROM date)
        ) stats;
    ELSE
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT to_char(date, 'DD Mon') as name, SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date
              AND (status IS NULL OR status IN ('completed', 'success', 'paid'))
            GROUP BY 1, date_trunc('day', date)
            ORDER BY date_trunc('day', date)
        ) stats;
    END IF;

    -- 3. Category Stats
    SELECT jsonb_agg(dataset) INTO v_category_stats
    FROM (
        SELECT 
            COALESCE(c.name, 'Uncategorized') as name,
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as value
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON p.id::TEXT = (item->>'id')
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date AND t.date <= p_end_date
          AND (t.status IS NULL OR t.status IN ('completed', 'success', 'paid'))
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 8
    ) dataset;

    -- 4. Top Products
    SELECT jsonb_agg(top) INTO v_top_products
    FROM (
        SELECT 
            item->>'name' as name,
            SUM((item->>'qty')::numeric) as sold,
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as revenue
        FROM transactions t, jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date
          AND (t.status IS NULL OR t.status IN ('completed', 'success', 'paid'))
        GROUP BY 1 ORDER BY 3 DESC LIMIT 10
    ) top;

    -- 5. Recent Transactions (NO date filter)
    SELECT jsonb_agg(recent) INTO v_recent_transactions
    FROM (
        SELECT id, cashier, date, total, status
        FROM transactions
        WHERE store_id = p_store_id 
          AND (status IS NULL OR status IN ('completed', 'success', 'paid'))
        ORDER BY date DESC LIMIT 5
    ) recent;

    RETURN jsonb_build_object(
        'totalSales', v_total_sales, 'totalTransactions', v_total_transactions, 'avgOrder', v_avg_order,
        'chartData', COALESCE(v_chart_data, '[]'::jsonb),
        'categoryData', COALESCE(v_category_stats, '[]'::jsonb),
        'topProducts', COALESCE(v_top_products, '[]'::jsonb),
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- =====================================================================================
-- STEP 3: Recreate get_store_initial_snapshot (ONE version - UUID)
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.get_store_initial_snapshot(p_store_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_categories JSONB; v_summary JSONB;
BEGIN
    SELECT jsonb_agg(cat_data) INTO v_categories
    FROM (
        SELECT c.id, c.name,
            COUNT(p.id) FILTER (WHERE p.is_deleted = false) as "productCount"
        FROM public.categories c
        LEFT JOIN public.products p ON p.category_id = c.id
        WHERE c.store_id = p_store_id
        GROUP BY c.id, c.name ORDER BY c.name ASC
    ) cat_data;

    SELECT jsonb_build_object(
        'totalProducts', COUNT(*) FILTER (WHERE is_deleted = false),
        'totalStock', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) ELSE 0 END),
        'totalValue', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) * COALESCE(buy_price, 0) ELSE 0 END),
        'outOfStock', COUNT(*) FILTER (WHERE is_deleted = false AND stock <= 0),
        'lowStock', COUNT(*) FILTER (WHERE is_deleted = false AND stock > 0 AND stock <= COALESCE(min_stock, 10))
    ) INTO v_summary FROM public.products WHERE store_id = p_store_id;

    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'summary', COALESCE(v_summary, '{"totalProducts":0,"totalStock":0,"totalValue":0,"outOfStock":0,"lowStock":0}'::jsonb)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_initial_snapshot(UUID) TO authenticated;

-- =====================================================================================
-- STEP 4: Recreate get_products_page (ONE version - UUID)
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.get_products_page(
    p_store_id UUID, p_page INT, p_page_size INT,
    p_search TEXT DEFAULT '', p_category TEXT DEFAULT 'all',
    p_satuan_po TEXT DEFAULT 'all', p_sort_key TEXT DEFAULT 'name', p_sort_dir TEXT DEFAULT 'asc'
) RETURNS JSONB SECURITY DEFINER SET search_path = public LANGUAGE plpgsql AS $$
DECLARE v_offset INT; v_total BIGINT; v_products JSONB;
BEGIN
    v_offset := (p_page - 1) * p_page_size;
    SELECT COUNT(*) INTO v_total FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = p_store_id AND p.is_deleted = false
    AND (p_search = '' OR p.name ILIKE '%' || p_search || '%' OR p.barcode ILIKE '%' || p_search || '%')
    AND (p_category = 'all' OR c.name = p_category OR p.category_id::text = p_category)
    AND (p_satuan_po = 'all' OR (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR (p_satuan_po = 'no' AND p.purchase_unit IS NULL));

    SELECT jsonb_agg(row_to_json(pd)::jsonb) INTO v_products FROM (
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

GRANT EXECUTE ON FUNCTION public.get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =====================================================================================
-- STEP 5: Recreate get_dashboard_monthly_summary (ONE version - UUID)
-- =====================================================================================
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
        FROM transactions t WHERE t.store_id = p_store_id AND EXTRACT(YEAR FROM t.date) = p_year
          AND (t.status IS NULL OR t.status IN ('completed', 'success', 'paid'))
        GROUP BY 1
    ),
    monthly_expenses AS (
        SELECT EXTRACT(MONTH FROM cf.date)::INTEGER as month_num, COALESCE(SUM(cf.amount), 0) as total_opex
        FROM cash_flow cf WHERE cf.store_id = p_store_id AND EXTRACT(YEAR FROM cf.date) = p_year
          AND cf.type = 'out' AND (cf.expense_group IS NULL OR cf.expense_group != 'asset')
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

GRANT EXECUTE ON FUNCTION public.get_dashboard_monthly_summary(UUID, INTEGER) TO authenticated;

-- =====================================================================================
-- STEP 6: Force schema reload
-- =====================================================================================
NOTIFY pgrst, 'reload schema';
