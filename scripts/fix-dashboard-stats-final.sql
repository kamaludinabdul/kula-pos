-- FINAL DASHBOARD STATS FIX
-- Broadens status filters and adds stock alert counts to the initial snapshot.
-- Supports both UUID and TEXT (NanoID) for p_store_id.

BEGIN;

-- 1. Fix get_store_initial_snapshot (Add outOfStock and lowStock alerts)
DROP FUNCTION IF EXISTS public.get_store_initial_snapshot(UUID);
DROP FUNCTION IF EXISTS public.get_store_initial_snapshot(TEXT);

CREATE OR REPLACE FUNCTION public.get_store_initial_snapshot(p_store_id TEXT)
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
            COUNT(p.id) FILTER (WHERE p.is_deleted = false) as "productCount"
        FROM public.categories c
        LEFT JOIN public.products p ON p.category_id = c.id
        WHERE c.store_id::text = p_store_id
        GROUP BY c.id, c.name
        ORDER BY c.name ASC
    ) cat_data;

    -- Fetch Summary Stats including Stock Alerts
    SELECT jsonb_build_object(
        'totalProducts', COUNT(*) FILTER (WHERE is_deleted = false),
        'totalStock', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) ELSE 0 END),
        'totalValue', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) * COALESCE(buy_price, 0) ELSE 0 END),
        'outOfStock', COUNT(*) FILTER (WHERE is_deleted = false AND stock <= 0),
        'lowStock', COUNT(*) FILTER (WHERE is_deleted = false AND stock > 0 AND stock <= COALESCE(min_stock, 10))
    )
    INTO v_summary
    FROM public.products
    WHERE store_id::text = p_store_id;

    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'summary', COALESCE(v_summary, '{"totalProducts": 0, "totalStock": 0, "totalValue": 0, "outOfStock": 0, "lowStock": 0}'::jsonb)
    );
END;
$$;

-- 2. Fix get_dashboard_stats (Broaden status and support TEXT ID)
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_store_id TEXT,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day'
) RETURNS JSONB AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_transactions INT := 0;
    v_avg_order NUMERIC := 0;
    v_chart_data JSONB;
    v_category_stats JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
BEGIN
    -- 1. General Stats (Totals) - Includes 'paid' status
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*),
        COALESCE(AVG(total), 0)
    INTO 
        v_total_sales,
        v_total_transactions,
        v_avg_order
    FROM transactions
    WHERE store_id::text = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date
      AND status IN ('completed', 'success', 'paid');

    -- 2. Chart Data
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date_trunc('hour', date), 'HH24:00') as name,
                EXTRACT(HOUR FROM date) as hour,
                SUM(total) as total
            FROM transactions
            WHERE store_id::text = p_store_id 
              AND date >= p_start_date 
              AND date <= p_end_date
              AND status IN ('completed', 'success', 'paid')
            GROUP BY 1, 2
            ORDER BY 2
        ) stats;
    ELSE
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date, 'DD Mon') as name,
                date_trunc('day', date) as date_val,
                SUM(total) as total
            FROM transactions
            WHERE store_id::text = p_store_id 
              AND date >= p_start_date 
              AND date <= p_end_date
              AND status IN ('completed', 'success', 'paid')
            GROUP BY 1, 2
            ORDER BY 2
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
        LEFT JOIN products p ON p.id::text = (item->>'id')
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id::text = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND t.status IN ('completed', 'success', 'paid')
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 6
    ) dataset;

    -- 4. Top Selling Products
    SELECT jsonb_agg(top) INTO v_top_products
    FROM (
        SELECT 
            item->>'name' as name,
            SUM((item->>'qty')::numeric) as sold,
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as revenue
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        WHERE t.store_id::text = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND t.status IN ('completed', 'success', 'paid')
        GROUP BY 1
        ORDER BY 3 DESC
        LIMIT 10
    ) top;

    -- 5. Recent Transactions
    SELECT jsonb_agg(recent) INTO v_recent_transactions
    FROM (
        SELECT id, cashier, date, total, status
        FROM transactions
        WHERE store_id::text = p_store_id 
          AND status IN ('completed', 'success', 'paid')
        ORDER BY date DESC
        LIMIT 5
    ) recent;

    RETURN jsonb_build_object(
        'totalSales', v_total_sales,
        'totalTransactions', v_total_transactions,
        'avgOrder', v_avg_order,
        'chartData', COALESCE(v_chart_data, '[]'::jsonb),
        'categoryData', COALESCE(v_category_stats, '[]'::jsonb),
        'topProducts', COALESCE(v_top_products, '[]'::jsonb),
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;

COMMIT;
