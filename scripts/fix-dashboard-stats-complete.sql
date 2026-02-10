-- =====================================================================================
-- FIX: get_dashboard_stats with FULL category data + relaxed status filter
-- Run this AFTER master-fix-all-data.sql
-- =====================================================================================

DROP FUNCTION IF EXISTS get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION get_dashboard_stats(
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
    -- 1. General Stats
    -- RELAXED: status IS NULL means it was never set (old transactions)
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*),
        COALESCE(AVG(total), 0)
    INTO v_total_sales, v_total_transactions, v_avg_order
    FROM transactions
    WHERE store_id = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date
      AND (status IS NULL OR status IN ('completed', 'success'));

    -- 2. Chart Data (Time Series)
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date_trunc('hour', date), 'HH24:00') as name,
                SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id 
              AND date >= p_start_date AND date <= p_end_date
              AND (status IS NULL OR status IN ('completed', 'success'))
            GROUP BY 1, EXTRACT(HOUR FROM date)
            ORDER BY EXTRACT(HOUR FROM date)
        ) stats;
    ELSE
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date, 'DD Mon') as name,
                SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id 
              AND date >= p_start_date AND date <= p_end_date
              AND (status IS NULL OR status IN ('completed', 'success'))
            GROUP BY 1, date_trunc('day', date)
            ORDER BY date_trunc('day', date)
        ) stats;
    END IF;

    -- 3. Category Stats (SALES PER CATEGORY)
    SELECT jsonb_agg(dataset) INTO v_category_stats
    FROM (
        SELECT 
            COALESCE(c.name, 'Uncategorized') as name,
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as value
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON p.id = (item->>'id')::UUID
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date AND t.date <= p_end_date
          AND (t.status IS NULL OR t.status IN ('completed', 'success'))
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 8
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
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date AND t.date <= p_end_date
          AND (t.status IS NULL OR t.status IN ('completed', 'success'))
        GROUP BY 1
        ORDER BY 3 DESC
        LIMIT 10
    ) top;

    -- 5. Recent Transactions (NO date filter - always show latest 5)
    SELECT jsonb_agg(recent) INTO v_recent_transactions
    FROM (
        SELECT id, cashier, date, total, status
        FROM transactions
        WHERE store_id = p_store_id 
          AND (status IS NULL OR status IN ('completed', 'success'))
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
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
