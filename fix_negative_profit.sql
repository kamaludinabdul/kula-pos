-- ===========================================================================
-- FIX: Negative Profit Calculation
-- Root Cause: expense_group filter included ALL cash outflows as OpEx
-- ===========================================================================

-- Step 1: Drop ALL possible overloaded versions of these functions
-- (covering 4-param and 5-param, TEXT and UUID versions)
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(TEXT, INTEGER);

DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

DROP FUNCTION IF EXISTS public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_profit_loss_report(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

-- Step 2: Recreate get_dashboard_monthly_summary (UUID only)
CREATE OR REPLACE FUNCTION public.get_dashboard_monthly_summary(
    p_store_id UUID, 
    p_year INTEGER
) RETURNS JSONB
AS $$
DECLARE v_result JSONB;
BEGIN
    WITH transaction_items AS (
        SELECT 
            EXTRACT(MONTH FROM (t.date AT TIME ZONE 'Asia/Jakarta'))::INTEGER as month_num,
            t.id as trans_id,
            t.total,
            t.date,
            (SELECT COALESCE(SUM((item->>'qty')::NUMERIC * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)), 0)
             FROM jsonb_array_elements(t.items) as item) as item_cogs
        FROM transactions t
        WHERE t.store_id = p_store_id 
          AND EXTRACT(YEAR FROM (t.date AT TIME ZONE 'Asia/Jakarta')) = p_year 
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
    ),
    monthly_data AS (
        SELECT 
            month_num,
            COUNT(trans_id) as transaction_count,
            SUM(total) as total_revenue,
            SUM(total - item_cogs) as total_gross_profit,
            COUNT(DISTINCT DATE(date AT TIME ZONE 'Asia/Jakarta')) as days_with_sales
        FROM transaction_items
        GROUP BY month_num
    ),
    monthly_expenses AS (
        SELECT 
            EXTRACT(MONTH FROM (cf.date AT TIME ZONE 'Asia/Jakarta'))::INTEGER as month_num, 
            COALESCE(SUM(cf.amount), 0) as total_opex
        FROM cash_flow cf
        WHERE cf.store_id = p_store_id 
          AND EXTRACT(YEAR FROM (cf.date AT TIME ZONE 'Asia/Jakarta')) = p_year 
          AND cf.type = 'out' 
          AND cf.expense_group IN ('operational', 'OPEX', 'write_off')
        GROUP BY EXTRACT(MONTH FROM (cf.date AT TIME ZONE 'Asia/Jakarta'))
    ),
    all_months AS (SELECT generate_series(1, 12) as month_num)
    SELECT jsonb_agg(
        jsonb_build_object(
            'monthIndex', am.month_num - 1,
            'name', TO_CHAR(DATE '2020-01-01' + ((am.month_num - 1) || ' month')::interval, 'Mon'),
            'totalRevenue', COALESCE(md.total_revenue, 0),
            'totalProfit', COALESCE(md.total_gross_profit, 0) - COALESCE(me.total_opex, 0),
            'totalOpEx', COALESCE(me.total_opex, 0),
            'transactionsCount', COALESCE(md.transaction_count, 0),
            'daysWithSales', COALESCE(md.days_with_sales, 0),
            'avgDailyRevenue', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN COALESCE(md.total_revenue, 0) / md.days_with_sales ELSE 0 END,
            'avgDailyGrossProfit', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN COALESCE(md.total_gross_profit, 0) / md.days_with_sales ELSE 0 END,
            'avgDailyProfit', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN (COALESCE(md.total_gross_profit, 0) - COALESCE(me.total_opex, 0)) / md.days_with_sales ELSE 0 END
        ) ORDER BY am.month_num
    ) INTO v_result
    FROM all_months am 
    LEFT JOIN monthly_data md ON md.month_num = am.month_num 
    LEFT JOIN monthly_expenses me ON me.month_num = am.month_num;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Step 3: Recreate get_dashboard_stats (UUID only, 5 params)
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

    -- OpEx: ONLY explicitly tagged operational expenses
    SELECT COALESCE(SUM(amount), 0) INTO v_total_opex
    FROM cash_flow
    WHERE store_id = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date
      AND type = 'out'
      AND expense_group IN ('operational', 'OPEX', 'write_off');

    v_total_net_profit := v_total_gross_profit - v_total_opex;

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


-- Step 4: Recreate get_profit_loss_report (TEXT for compatibility)
DROP FUNCTION IF EXISTS public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_profit_loss_report(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
    p_store_id TEXT,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS JSONB 
AS $$
DECLARE
    v_total_sales NUMERIC := 0; v_total_cogs NUMERIC := 0; v_total_discount NUMERIC := 0; v_total_tax NUMERIC := 0;
    v_total_transactions INTEGER := 0; v_total_items NUMERIC := 0; v_total_expenses NUMERIC := 0;
    v_other_income NUMERIC := 0; v_total_assets NUMERIC := 0; v_net_profit NUMERIC := 0;
    v_total_cash NUMERIC := 0; v_total_qris NUMERIC := 0; v_total_transfer NUMERIC := 0;
BEGIN
    SELECT 
        COALESCE(SUM(total), 0), 
        COALESCE(SUM(discount), 0), 
        COALESCE(SUM(tax), 0), 
        COUNT(*),
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'qris' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'transfer' THEN total ELSE 0 END), 0)
    INTO 
        v_total_sales, v_total_discount, v_total_tax, v_total_transactions,
        v_total_cash, v_total_qris, v_total_transfer
    FROM transactions 
    WHERE store_id::text = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date 
      AND (LOWER(status) IN ('completed', 'success', 'paid', 'berhasil') OR status IS NULL);

    WITH expanded_items AS (
        SELECT COALESCE((item->>'qty')::NUMERIC, 0) as q, COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c
        FROM transactions t, jsonb_array_elements(t.items) as item
        WHERE t.store_id::text = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date 
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
    )
    SELECT COALESCE(SUM(q), 0), COALESCE(SUM(q * c), 0) INTO v_total_items, v_total_cogs FROM expanded_items;

    -- OpEx: ONLY explicitly tagged operational expenses (NO COALESCE default!)
    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_expenses FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow UNION ALL SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf WHERE cf.store_id::text = p_store_id 
          AND cf.date >= p_start_date 
          AND cf.date <= p_end_date 
          AND cf.type IN ('out', 'expense') 
          AND cf.expense_group IN ('OPEX', 'operational', 'write_off');

    SELECT COALESCE(SUM(amount), 0) INTO v_other_income FROM cash_flow WHERE store_id::text = p_store_id AND date >= p_start_date AND date <= p_end_date AND type = 'income';
    SELECT COALESCE(SUM(amount), 0) INTO v_total_assets FROM cash_flow WHERE store_id::text = p_store_id AND date >= p_start_date AND date <= p_end_date AND expense_group = 'asset';

    v_net_profit := v_total_sales - v_total_cogs - v_total_expenses + v_other_income;

    RETURN jsonb_build_object(
        'total_sales', v_total_sales, 
        'total_cogs', v_total_cogs, 
        'total_expenses', v_total_expenses, 
        'other_income', v_other_income, 
        'total_assets', v_total_assets,
        'net_profit', v_net_profit,
        'gross_profit', v_total_sales - v_total_cogs,
        'total_discount', v_total_discount, 
        'total_tax', v_total_tax, 
        'total_transactions', v_total_transactions,
        'total_items', v_total_items,
        'total_cash', v_total_cash,
        'total_qris', v_total_qris,
        'total_transfer', v_total_transfer
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Step 5: Verify no overloaded functions remain
DO $$
DECLARE
    fn_count INT;
BEGIN
    SELECT COUNT(*) INTO fn_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'get_dashboard_stats';
    
    IF fn_count > 1 THEN
        RAISE WARNING 'WARNING: % overloaded versions of get_dashboard_stats still exist!', fn_count;
    ELSE
        RAISE NOTICE 'OK: get_dashboard_stats has exactly % version(s)', fn_count;
    END IF;

    SELECT COUNT(*) INTO fn_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'get_dashboard_monthly_summary';
    
    IF fn_count > 1 THEN
        RAISE WARNING 'WARNING: % overloaded versions of get_dashboard_monthly_summary still exist!', fn_count;
    ELSE
        RAISE NOTICE 'OK: get_dashboard_monthly_summary has exactly % version(s)', fn_count;
    END IF;
END $$;
