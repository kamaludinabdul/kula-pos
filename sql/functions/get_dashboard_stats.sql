DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day',
    p_timezone TEXT DEFAULT 'Asia/Jakarta'
) RETURNS JSONB 
AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_transactions INT := 0;
    v_avg_order NUMERIC := 0;
    v_total_cogs NUMERIC := 0;
    v_total_gross_profit NUMERIC := 0;
    v_total_opex NUMERIC := 0;
    v_total_net_profit NUMERIC := 0;
    v_chart_data JSONB;
    v_category_stats JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
BEGIN
    -- 1. General Stats (Totals)
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*),
        COALESCE(AVG(total), 0)
    INTO 
        v_total_sales,
        v_total_transactions,
        v_avg_order
    FROM transactions
    WHERE store_id = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date
      AND (LOWER(status) IN ('completed', 'success', 'paid', 'berhasil') OR status IS NULL);

    -- Calculate COGS
    WITH items_expanded AS (
        SELECT (item->>'qty')::numeric as q, 
               COALESCE((item->>'buyPrice')::numeric, (item->>'buy_price')::numeric, 0) as b
        FROM transactions t, jsonb_array_elements(items) as item
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
    )
    SELECT COALESCE(SUM(q * b), 0) INTO v_total_cogs FROM items_expanded;

    v_total_gross_profit := v_total_sales - v_total_cogs;

    -- Calculate OpEx
    SELECT COALESCE(SUM(amount), 0) INTO v_total_opex
    FROM cash_flow
    WHERE store_id = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date
      AND type = 'out'
      AND expense_group IN ('operational', 'OPEX', 'write_off');

    v_total_net_profit := v_total_gross_profit - v_total_opex;

    -- 2. Chart Data
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date_trunc('hour', date AT TIME ZONE p_timezone), 'HH24:00') as name,
                EXTRACT(HOUR FROM date AT TIME ZONE p_timezone) as hour,
                SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id 
              AND date >= p_start_date 
              AND date <= p_end_date
              AND (LOWER(status) IN ('completed', 'success', 'paid', 'berhasil') OR status IS NULL)
            GROUP BY 1, 2
            ORDER BY 2
        ) stats;
    ELSE
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date AT TIME ZONE p_timezone, 'DD Mon') as name,
                date_trunc('day', date AT TIME ZONE p_timezone) as date_val,
                SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id 
              AND date >= p_start_date 
              AND date <= p_end_date
              AND (LOWER(status) IN ('completed', 'success', 'paid', 'berhasil') OR status IS NULL)
            GROUP BY 1, 2
            ORDER BY 2
        ) stats;
    END IF;

    -- 3. Category Stats
    SELECT jsonb_agg(dataset) INTO v_category_stats
    FROM (
        SELECT 
            COALESCE(c.name, 'Uncategorized') as name,
            SUM((item->>'qty')::numeric * COALESCE((item->>'price')::numeric, (item->>'sellPrice')::numeric, (item->>'sell_price')::numeric, 0)) as value
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON p.id::text = (item->>'id')
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
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
            SUM((item->>'qty')::numeric * COALESCE((item->>'price')::numeric, (item->>'sellPrice')::numeric, (item->>'sell_price')::numeric, 0)) as revenue
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
        GROUP BY 1
        ORDER BY 3 DESC
        LIMIT 10
    ) top;

    -- 5. Recent Transactions
    SELECT jsonb_agg(recent) INTO v_recent_transactions
    FROM (
        SELECT t.id, COALESCE(prof.name, t.cashier) as cashier, t.date, t.total, t.status
        FROM transactions t
        LEFT JOIN profiles prof ON prof.id = t.cashier_id
        WHERE t.store_id = p_store_id 
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
        ORDER BY t.date DESC
        LIMIT 5
    ) recent;

    RETURN jsonb_build_object(
        'totalSales', v_total_sales,
        'totalTransactions', v_total_transactions,
        'avgOrder', v_avg_order,
        'totalGrossProfit', v_total_gross_profit,
        'totalNetProfit', v_total_net_profit,
        'totalProfit', v_total_net_profit,
        'chartData', COALESCE(v_chart_data, '[]'::jsonb),
        'categoryData', COALESCE(v_category_stats, '[]'::jsonb),
        'topProducts', COALESCE(v_top_products, '[]'::jsonb),
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
