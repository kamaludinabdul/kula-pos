-- KULAPOS PRODUCTION DASHBOARD REPAIR
-- Restores full sales and profit logic while maintaining Expiry/Write-off support

BEGIN;

-- 0. DROP ALL CONFLICTING FUNCTION SIGNATURES
-- This resolves PGRST203 "Multiple Choices" error
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

DROP FUNCTION IF EXISTS public.get_owner_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ);

DROP FUNCTION IF EXISTS public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_profit_loss_report(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

-- 1. get_dashboard_stats (Store Dashboard Cards & Charts)
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
    v_category_data JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
BEGIN
    -- Set timezone for this session
    EXECUTE 'SET LOCAL TIME ZONE ' || quote_literal(p_timezone);

    -- Base Stats: Sales, Transactions, and COGS
    SELECT 
        COALESCE(SUM(total), 0), 
        COUNT(*), 
        COALESCE(AVG(total), 0),
        COALESCE(SUM((
            SELECT SUM(
                COALESCE((item->>'qty')::numeric, 0) * 
                COALESCE((item->>'buyPrice')::numeric, (item->>'buy_price')::numeric, 0)
            ) FROM jsonb_array_elements(t.items) as item
        )), 0)
    INTO v_total_sales, v_total_transactions, v_avg_order, v_total_cogs
    FROM transactions t
    WHERE store_id::text = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND status IN ('completed', 'success', 'paid', 'paid_off');

    -- Get OPEX (Operational Expenditures - Cash Out)
    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_opex
    FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow
        UNION ALL
        SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf
    WHERE cf.store_id::text = p_store_id 
      AND cf.date >= p_start_date AND cf.date <= p_end_date 
      AND cf.type IN ('out', 'expense') 
      AND COALESCE(cf.expense_group, 'operational') = 'operational';

    -- Chart Data
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data FROM (
            SELECT 
                to_char(date AT TIME ZONE p_timezone, 'HH24:00') as name, 
                EXTRACT(HOUR FROM (date AT TIME ZONE p_timezone)) as hour, 
                SUM(total) as total
            FROM transactions 
            WHERE store_id::text = p_store_id 
              AND date >= p_start_date AND date <= p_end_date 
              AND status IN ('completed', 'success', 'paid', 'paid_off') 
            GROUP BY 1, 2 ORDER BY 2
        ) stats;
    ELSE
        SELECT jsonb_agg(stats) INTO v_chart_data FROM (
            SELECT 
                to_char(date AT TIME ZONE p_timezone, 'DD/MM') as name, 
                date_trunc('day', date AT TIME ZONE p_timezone) as date_val, 
                SUM(total) as total
            FROM transactions 
            WHERE store_id::text = p_store_id 
              AND date >= p_start_date AND date <= p_end_date 
              AND status IN ('completed', 'success', 'paid', 'paid_off') 
            GROUP BY 1, 2 ORDER BY 2
        ) stats;
    END IF;

    -- Category Stats
    SELECT jsonb_agg(dataset) INTO v_category_data FROM (
        SELECT COALESCE(c.name, 'Lainnya') as name, SUM((item->>'total')::numeric) as value
        FROM transactions t, jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON p.id::text = (item->>'id') 
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id::text = p_store_id 
          AND t.date >= p_start_date AND t.date <= p_end_date 
          AND t.status IN ('completed', 'success', 'paid', 'paid_off') 
        GROUP BY 1 ORDER BY 2 DESC LIMIT 6
    ) dataset;

    -- Top Products
    SELECT jsonb_agg(top) INTO v_top_products FROM (
        SELECT item->>'name' as name, SUM((item->>'qty')::numeric) as sold, SUM((item->>'total')::numeric) as revenue
        FROM transactions t, jsonb_array_elements(t.items) as item
        WHERE t.store_id::text = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status IN ('completed', 'success', 'paid', 'paid_off') GROUP BY 1 ORDER BY 3 DESC LIMIT 10
    ) top;

    -- Recent Transactions
    SELECT jsonb_agg(recent) INTO v_recent_transactions FROM (
        SELECT id, cashier, date, total, status FROM transactions WHERE store_id::text = p_store_id AND status IN ('completed', 'success', 'paid', 'paid_off') ORDER BY date DESC LIMIT 5
    ) recent;

    RETURN jsonb_build_object(
        'totalSales', v_total_sales, 
        'totalTransactions', v_total_transactions, 
        'avgOrder', v_avg_order, 
        'totalGrossProfit', v_total_sales - v_total_cogs,
        'totalNetProfit', v_total_sales - v_total_cogs - v_total_opex,
        'chartData', COALESCE(v_chart_data, '[]'::jsonb), 
        'categoryData', COALESCE(v_category_data, '[]'::jsonb), 
        'topProducts', COALESCE(v_top_products, '[]'::jsonb), 
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. get_owner_dashboard_stats (Owner View Summary)
CREATE OR REPLACE FUNCTION public.get_owner_dashboard_stats(p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_result JSON;
    v_user_id UUID;
    v_total_opex NUMERIC := 0;
    v_total_sales NUMERIC := 0;
    v_total_cogs NUMERIC := 0;
    v_total_transactions INT := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;

    -- Get total metrics
    SELECT 
        COALESCE(SUM(t.total), 0),
        COALESCE(COUNT(t.id), 0),
        COALESCE(SUM((
            SELECT SUM(COALESCE((item->>'qty')::numeric, 0) * COALESCE((item->>'buyPrice')::numeric, (item->>'buy_price')::numeric, 0))
            FROM jsonb_array_elements(t.items) as item
        )), 0)
    INTO v_total_sales, v_total_transactions, v_total_cogs
    FROM stores s
    LEFT JOIN transactions t ON t.store_id = s.id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status IN ('completed', 'success', 'paid', 'paid_off')
    WHERE s.owner_id = v_user_id;

    -- Get total opex
    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_opex
    FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow
        UNION ALL
        SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf
    JOIN stores s ON s.id = cf.store_id
    WHERE s.owner_id = v_user_id 
      AND cf.date >= p_start_date AND cf.date <= p_end_date 
      AND cf.type IN ('out', 'expense') 
      AND COALESCE(cf.expense_group, 'operational') = 'operational';
    
    SELECT json_build_object(
        'totalSales', v_total_sales,
        'totalTransactions', v_total_transactions,
        'avgOrder', CASE WHEN v_total_transactions > 0 THEN v_total_sales / v_total_transactions ELSE 0 END,
        'totalGrossProfit', v_total_sales - v_total_cogs,
        'totalNetProfit', v_total_sales - v_total_cogs - v_total_opex,
        'storeBreakdown', (SELECT COALESCE(json_agg(store_data), '[]'::json) FROM (SELECT s.id as store_id, s.name as store_name, s.plan, COALESCE(SUM(CASE WHEN tx.status IN ('completed', 'success', 'paid', 'paid_off') THEN tx.total ELSE 0 END), 0) as total_sales, COALESCE(COUNT(CASE WHEN tx.status IN ('completed', 'success', 'paid', 'paid_off') THEN 1 END), 0) as total_transactions FROM stores s LEFT JOIN transactions tx ON tx.store_id = s.id AND tx.date >= p_start_date AND tx.date <= p_end_date WHERE s.owner_id = v_user_id GROUP BY s.id, s.name, s.plan ORDER BY total_sales DESC) store_data),
        'totalStores', (SELECT COUNT(*) FROM stores WHERE owner_id = v_user_id)
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- 3. get_profit_loss_report (Laporan Laba Rugi)
CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
    v_total_sales NUMERIC;
    v_total_cogs NUMERIC;
    v_total_expenses NUMERIC; -- Operational (Cash)
    v_total_write_offs NUMERIC; -- Non-Cash
    v_other_income NUMERIC;
    v_total_assets NUMERIC;
    v_total_tax NUMERIC;
    v_total_discount NUMERIC;
    v_total_transactions INT;
    v_total_items INT;
BEGIN
    -- 1. Calculate Sales, Tax, Discount, COGS
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(tax), 0),
        COALESCE(SUM(discount), 0),
        COUNT(*),
        COALESCE(SUM(jsonb_array_length(items)), 0),
        COALESCE(SUM((
            SELECT SUM(
                COALESCE((item->>'qty')::numeric, 0) * 
                COALESCE((item->>'buyPrice')::numeric, (item->>'buy_price')::numeric, 0)
            ) FROM jsonb_array_elements(t.items) as item
        )), 0)
    INTO 
        v_total_sales, v_total_tax, v_total_discount, v_total_transactions, v_total_items, v_total_cogs
    FROM transactions t
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND status IN ('completed', 'success', 'paid', 'paid_off');

    -- 2. Calculate Expenses (Grouped)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND type = 'out' 
      AND COALESCE(expense_group, 'operational') = 'operational';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_write_offs 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND type = 'out' 
      AND expense_group = 'write_off';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_assets 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND type = 'out' 
      AND expense_group = 'asset';

    SELECT COALESCE(SUM(amount), 0) INTO v_other_income 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND type = 'in';

    RETURN jsonb_build_object(
        'total_sales', v_total_sales,
        'total_cogs', v_total_cogs,
        'total_expenses', v_total_expenses,
        'total_write_offs', v_total_write_offs,
        'other_income', v_other_income,
        'total_assets', v_total_assets,
        'total_tax', v_total_tax,
        'total_discount', v_total_discount,
        'total_transactions', v_total_transactions,
        'total_items', v_total_items,
        'net_profit', v_total_sales - v_total_cogs - v_total_expenses - v_total_write_offs + v_other_income
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-grant permissions
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMIT;
