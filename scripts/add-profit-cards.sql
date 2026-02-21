-- =============================================================================
-- KASIR PRO SUPABASE - ADD PROFIT CARDS TO DASHBOARD RPCS
-- =============================================================================
-- This script modifies the two primary dashboard stats RPCs to compute
-- and return 'totalProfit'.
-- Profit = (Total Sales) - (Total COGS) - (Total OPEX)
-- =============================================================================

BEGIN;

-- 1. Update get_dashboard_stats (Dashboard Toko)
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_store_id TEXT,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day',
    p_timezone TEXT DEFAULT 'Asia/Jakarta'
) RETURNS JSONB AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_transactions INT := 0;
    v_avg_order NUMERIC := 0;
    v_total_cogs NUMERIC := 0;
    v_total_opex NUMERIC := 0;
    v_chart_data JSONB;
    v_category_stats JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
BEGIN
    -- 1.a General Stats (Totals) & COGS
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*),
        COALESCE(AVG(total), 0),
        COALESCE(SUM((
            SELECT SUM(COALESCE((item->>'qty')::numeric, 0) * COALESCE((item->>'buyPrice')::numeric, (item->>'buy_price')::numeric, 0))
            FROM jsonb_array_elements(t.items) as item
        )), 0)
    INTO 
        v_total_sales,
        v_total_transactions,
        v_avg_order,
        v_total_cogs
    FROM transactions t
    WHERE store_id::text = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date
      AND status IN ('completed', 'success', 'paid');

    -- 1.b Get OPEX for the period
    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_opex
    FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow
        UNION ALL
        SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf
    WHERE cf.store_id::text = p_store_id
      AND cf.date >= p_start_date
      AND cf.date <= p_end_date
      AND cf.type IN ('out', 'expense')
      AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational');


    -- 2. Chart Data (Timezone Sensitive)
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date AT TIME ZONE p_timezone, 'HH24:00') as name,
                EXTRACT(HOUR FROM (date AT TIME ZONE p_timezone)) as hour,
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
                to_char(date AT TIME ZONE p_timezone, 'DD Mon') as name,
                date_trunc('day', date AT TIME ZONE p_timezone) as date_val,
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
        'totalProfit', v_total_sales - v_total_cogs - v_total_opex,
        'chartData', COALESCE(v_chart_data, '[]'::jsonb),
        'categoryData', COALESCE(v_category_stats, '[]'::jsonb),
        'topProducts', COALESCE(v_top_products, '[]'::jsonb),
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- 2. Update get_owner_dashboard_stats (Dashboard Owner)
DROP FUNCTION IF EXISTS public.get_owner_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_owner_dashboard_stats(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
    v_user_id UUID;
    v_total_opex NUMERIC := 0;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('error', 'Not authenticated');
    END IF;

    -- 1. Calculate total OPEX across all owner's stores for the period
    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_opex
    FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow
        UNION ALL
        SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf
    JOIN stores s ON s.id = cf.store_id
    WHERE s.owner_id = v_user_id
        AND cf.date >= p_start_date 
        AND cf.date <= p_end_date
        AND cf.type IN ('out', 'expense')
        AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational');
    
    -- 2. General Stats
    SELECT json_build_object(
        'totalSales', COALESCE(SUM(
            CASE WHEN t.status IN ('completed', 'paid') THEN t.total ELSE 0 END
        ), 0),
        'totalTransactions', COALESCE(COUNT(
            CASE WHEN t.status IN ('completed', 'paid') THEN 1 END
        ), 0),
        'avgOrder', CASE 
            WHEN COUNT(CASE WHEN t.status IN ('completed', 'paid') THEN 1 END) > 0 
            THEN COALESCE(SUM(CASE WHEN t.status IN ('completed', 'paid') THEN t.total ELSE 0 END), 0) 
                 / COUNT(CASE WHEN t.status IN ('completed', 'paid') THEN 1 END)
            ELSE 0 
        END,
        'totalProfit', COALESCE(SUM(
            CASE WHEN t.status IN ('completed', 'paid') THEN t.total ELSE 0 END
        ), 0) - COALESCE(SUM(
            CASE WHEN t.status IN ('completed', 'paid') THEN (
                SELECT COALESCE(SUM(COALESCE((item->>'qty')::NUMERIC, 0) * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)), 0)
                FROM jsonb_array_elements(t.items) as item
            ) ELSE 0 END
        ), 0) - v_total_opex,
        'storeBreakdown', (
            SELECT COALESCE(json_agg(store_data), '[]'::json)
            FROM (
                SELECT 
                    s.id as store_id,
                    s.name as store_name,
                    s.plan,
                    COALESCE(SUM(CASE WHEN tx.status IN ('completed', 'paid') THEN tx.total ELSE 0 END), 0) as total_sales,
                    COALESCE(COUNT(CASE WHEN tx.status IN ('completed', 'paid') THEN 1 END), 0) as total_transactions
                FROM stores s
                LEFT JOIN transactions tx ON tx.store_id = s.id 
                    AND tx.date >= p_start_date 
                    AND tx.date <= p_end_date
                WHERE s.owner_id = v_user_id
                GROUP BY s.id, s.name, s.plan
                ORDER BY total_sales DESC
            ) store_data
        ),
        'totalStores', (
            SELECT COUNT(*) FROM stores WHERE owner_id = v_user_id
        )
    ) INTO v_result
    FROM stores s
    LEFT JOIN transactions t ON t.store_id = s.id 
        AND t.date >= p_start_date 
        AND t.date <= p_end_date
    WHERE s.owner_id = v_user_id;
    
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
