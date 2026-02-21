-- SQL: Separate Gross Profit and Net Profit in RPCs
-- This script updates the dashboard functions to return both metrics.

BEGIN;

-- 1. Update get_dashboard_stats (Store Dashboard)
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
    -- Get sales and COGS
    SELECT COALESCE(SUM(total), 0), COUNT(*), COALESCE(AVG(total), 0),
        COALESCE(SUM((SELECT SUM(COALESCE((item->>'qty')::numeric, 0) * COALESCE((item->>'buyPrice')::numeric, (item->>'buy_price')::numeric, 0)) FROM jsonb_array_elements(t.items) as item)), 0)
    INTO v_total_sales, v_total_transactions, v_avg_order, v_total_cogs
    FROM transactions t
    WHERE store_id::text = p_store_id AND date >= p_start_date AND date <= p_end_date AND status IN ('completed', 'success', 'paid');

    -- Get OPEX
    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_opex
    FROM (SELECT date, amount, store_id, type, expense_group FROM cash_flow UNION ALL SELECT date, amount, store_id, type, expense_group FROM shift_movements) cf
    WHERE cf.store_id::text = p_store_id AND cf.date >= p_start_date AND cf.date <= p_end_date AND cf.type IN ('out', 'expense') AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational');

    -- Chart Data logic (Monthly/Daily)
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data FROM (
            SELECT to_char(date AT TIME ZONE p_timezone, 'HH24:00') as name, EXTRACT(HOUR FROM (date AT TIME ZONE p_timezone)) as hour, SUM(total) as total
            FROM transactions WHERE store_id::text = p_store_id AND date >= p_start_date AND date <= p_end_date AND status IN ('completed', 'success', 'paid') GROUP BY 1, 2 ORDER BY 2
        ) stats;
    ELSE
        SELECT jsonb_agg(stats) INTO v_chart_data FROM (
            SELECT to_char(date AT TIME ZONE p_timezone, 'DD Mon') as name, date_trunc('day', date AT TIME ZONE p_timezone) as date_val, SUM(total) as total
            FROM transactions WHERE store_id::text = p_store_id AND date >= p_start_date AND date <= p_end_date AND status IN ('completed', 'success', 'paid') GROUP BY 1, 2 ORDER BY 2
        ) stats;
    END IF;

    -- Category Stats
    SELECT jsonb_agg(dataset) INTO v_category_stats FROM (
        SELECT COALESCE(c.name, 'Uncategorized') as name, SUM((item->>'qty')::numeric * (item->>'price')::numeric) as value
        FROM transactions t, jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON p.id::text = (item->>'id') LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id::text = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status IN ('completed', 'success', 'paid') GROUP BY 1 ORDER BY 2 DESC LIMIT 6
    ) dataset;

    -- Top Products
    SELECT jsonb_agg(top) INTO v_top_products FROM (
        SELECT item->>'name' as name, SUM((item->>'qty')::numeric) as sold, SUM((item->>'qty')::numeric * (item->>'price')::numeric) as revenue
        FROM transactions t, jsonb_array_elements(t.items) as item
        WHERE t.store_id::text = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status IN ('completed', 'success', 'paid') GROUP BY 1 ORDER BY 3 DESC LIMIT 10
    ) top;

    -- Recent Transactions
    SELECT jsonb_agg(recent) INTO v_recent_transactions FROM (
        SELECT id, cashier, date, total, status FROM transactions WHERE store_id::text = p_store_id AND status IN ('completed', 'success', 'paid') ORDER BY date DESC LIMIT 5
    ) recent;

    RETURN jsonb_build_object(
        'totalSales', v_total_sales, 
        'totalTransactions', v_total_transactions, 
        'avgOrder', v_avg_order, 
        'totalGrossProfit', v_total_sales - v_total_cogs,
        'totalNetProfit', v_total_sales - v_total_cogs - v_total_opex,
        'totalProfit', v_total_sales - v_total_cogs - v_total_opex, -- Backwards compatibility
        'chartData', COALESCE(v_chart_data, '[]'::jsonb), 
        'categoryData', COALESCE(v_category_stats, '[]'::jsonb), 
        'topProducts', COALESCE(v_top_products, '[]'::jsonb), 
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update get_owner_dashboard_stats (Owner Dashboard Summary)
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

    -- Get total sales, cogs, transactions across all stores
    SELECT 
        COALESCE(SUM(t.total), 0),
        COALESCE(COUNT(t.id), 0),
        COALESCE(SUM((SELECT SUM(COALESCE((item->>'qty')::NUMERIC, 0) * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)) FROM jsonb_array_elements(t.items) as item)), 0)
    INTO v_total_sales, v_total_transactions, v_total_cogs
    FROM stores s
    LEFT JOIN transactions t ON t.store_id = s.id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status IN ('completed', 'paid')
    WHERE s.owner_id = v_user_id;

    -- Get total opex across all stores
    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_opex
    FROM (SELECT date, amount, store_id, type, expense_group FROM cash_flow UNION ALL SELECT date, amount, store_id, type, expense_group FROM shift_movements) cf
    JOIN stores s ON s.id = cf.store_id
    WHERE s.owner_id = v_user_id AND cf.date >= p_start_date AND cf.date <= p_end_date AND cf.type IN ('out', 'expense') AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational');
    
    SELECT json_build_object(
        'totalSales', v_total_sales,
        'totalTransactions', v_total_transactions,
        'avgOrder', CASE WHEN v_total_transactions > 0 THEN v_total_sales / v_total_transactions ELSE 0 END,
        'totalGrossProfit', v_total_sales - v_total_cogs,
        'totalNetProfit', v_total_sales - v_total_cogs - v_total_opex,
        'totalProfit', v_total_sales - v_total_cogs - v_total_opex, -- Backwards compatibility
        'storeBreakdown', (SELECT COALESCE(json_agg(store_data), '[]'::json) FROM (SELECT s.id as store_id, s.name as store_name, s.plan, COALESCE(SUM(CASE WHEN tx.status IN ('completed', 'paid') THEN tx.total ELSE 0 END), 0) as total_sales, COALESCE(COUNT(CASE WHEN tx.status IN ('completed', 'paid') THEN 1 END), 0) as total_transactions FROM stores s LEFT JOIN transactions tx ON tx.store_id = s.id AND tx.date >= p_start_date AND tx.date <= p_end_date WHERE s.owner_id = v_user_id GROUP BY s.id, s.name, s.plan ORDER BY total_sales DESC) store_data),
        'totalStores', (SELECT COUNT(*) FROM stores WHERE owner_id = v_user_id)
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;


-- 3. Update get_dashboard_monthly_summary (Store Dashboard Monthly Chart)
CREATE OR REPLACE FUNCTION public.get_dashboard_monthly_summary(
    p_store_id UUID,
    p_year INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH monthly_data AS (
        SELECT 
            EXTRACT(MONTH FROM t.date)::INTEGER as month_num,
            TO_CHAR(t.date, 'Mon') as month_name,
            COALESCE(SUM(t.total), 0) as total_revenue,
            COUNT(*) as transaction_count,
            COALESCE(SUM( (SELECT SUM(COALESCE((item->>'qty')::NUMERIC * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)), 0) FROM jsonb_array_elements(t.items) as item) ), 0) as total_cogs,
            COUNT(DISTINCT DATE(t.date)) as days_with_sales
        FROM transactions t
        WHERE t.store_id = p_store_id
          AND EXTRACT(YEAR FROM t.date) = p_year
          AND (t.status IS NULL OR t.status = 'completed' OR t.status = 'paid' OR t.status = 'success')
        GROUP BY EXTRACT(MONTH FROM t.date), TO_CHAR(t.date, 'Mon')
    ),
    monthly_expenses AS (
        SELECT 
            EXTRACT(MONTH FROM cf.date)::INTEGER as month_num,
            COALESCE(SUM(cf.amount::NUMERIC), 0) as total_opex
        FROM (
            SELECT date, amount, store_id, type, expense_group FROM cash_flow
            UNION ALL
            SELECT date, amount, store_id, type, expense_group FROM shift_movements
        ) cf
        WHERE cf.store_id = p_store_id
          AND EXTRACT(YEAR FROM cf.date) = p_year
          AND cf.type IN ('out', 'expense')
          AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational')
        GROUP BY EXTRACT(MONTH FROM cf.date)
    ),
    all_months AS (
        SELECT generate_series(1, 12) as month_num
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'monthIndex', am.month_num - 1,
            'name', TO_CHAR(DATE '2020-01-01' + ((am.month_num - 1) || ' month')::interval, 'Mon'),
            'totalRevenue', COALESCE(md.total_revenue, 0),
            'totalGrossProfit', COALESCE(md.total_revenue, 0) - COALESCE(md.total_cogs, 0),
            'totalNetProfit', COALESCE(md.total_revenue, 0) - COALESCE(md.total_cogs, 0) - COALESCE(me.total_opex, 0),
            'totalProfit', COALESCE(md.total_revenue, 0) - COALESCE(md.total_cogs, 0) - COALESCE(me.total_opex, 0), -- Net profit for charts
            'totalOpEx', COALESCE(me.total_opex, 0),
            'transactionsCount', COALESCE(md.transaction_count, 0),
            'daysWithSales', COALESCE(md.days_with_sales, 0),
            'avgDailyRevenue', CASE 
                WHEN COALESCE(md.days_with_sales, 0) > 0 
                THEN COALESCE(md.total_revenue, 0) / md.days_with_sales 
                ELSE 0 
            END,
            'avgDailyProfit', CASE 
                WHEN COALESCE(md.days_with_sales, 0) > 0 
                THEN (COALESCE(md.total_revenue, 0) - COALESCE(md.total_cogs, 0) - COALESCE(me.total_opex, 0)) / md.days_with_sales 
                ELSE 0 
            END
        )
        ORDER BY am.month_num
    ) INTO v_result
    FROM all_months am
    LEFT JOIN monthly_data md ON md.month_num = am.month_num
    LEFT JOIN monthly_expenses me ON me.month_num = am.month_num;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- 4. Update get_owner_financial_summary (Owner Dashboard Financial Summary)
CREATE OR REPLACE FUNCTION public.get_owner_financial_summary(
    p_year INT,
    p_timezone TEXT DEFAULT 'Asia/Jakarta'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
    v_result JSONB;
BEGIN
    v_owner_id := auth.uid();
    IF v_owner_id IS NULL THEN RETURN jsonb_build_array(); END IF;
    
    WITH months AS (
        SELECT (make_date(p_year, m, 1))::DATE as month_date
        FROM generate_series(1, 12) m
    ),
    store_monthly_sales AS (
        SELECT 
            date_trunc('month', t.date AT TIME ZONE p_timezone)::DATE as m_date,
            t.store_id,
            s.name as store_name,
            SUM(t.total) as sales,
            COUNT(*) as transactions,
            COUNT(DISTINCT (t.date AT TIME ZONE p_timezone)::date) as active_days,
            SUM((
                SELECT SUM(COALESCE((item->>'qty')::NUMERIC, 0) * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0))
                FROM jsonb_array_elements(t.items) as item
            )) as cogs
        FROM transactions t
        JOIN stores s ON t.store_id = s.id
        WHERE s.owner_id = v_owner_id
          AND t.status IN ('completed', 'paid', 'success')
          AND EXTRACT(YEAR FROM (t.date AT TIME ZONE p_timezone)) = p_year
        GROUP BY 1, 2, 3
    ),
    store_monthly_expenses AS (
        SELECT 
            date_trunc('month', cf.date)::DATE as m_date,
            cf.store_id,
            s.name as store_name,
            SUM(CASE WHEN cf.type IN ('out', 'expense') AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational') THEN cf.amount::NUMERIC ELSE 0 END) as expenses,
            SUM(CASE WHEN cf.type = 'income' THEN cf.amount::NUMERIC ELSE 0 END) as other_income
        FROM (
            SELECT date, amount, store_id, type, expense_group FROM cash_flow
            UNION ALL
            SELECT date, amount, store_id, type, expense_group FROM shift_movements
        ) cf
        JOIN stores s ON cf.store_id = s.id
        WHERE s.owner_id = v_owner_id
          AND EXTRACT(YEAR FROM cf.date) = p_year
        GROUP BY 1, 2, 3
    ),
    active_stores_per_month AS (
        SELECT DISTINCT m_date, store_id, store_name FROM store_monthly_sales
        UNION 
        SELECT DISTINCT m_date, store_id, store_name FROM store_monthly_expenses
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'month', EXTRACT(MONTH FROM m.month_date),
            'month_name', to_char(m.month_date, 'Mon'),
            'revenue', (SELECT COALESCE(SUM(sales), 0) FROM store_monthly_sales WHERE m_date = m.month_date),
            'expenses', (SELECT COALESCE(SUM(expenses), 0) FROM store_monthly_expenses WHERE m_date = m.month_date),
            'gross_profit', (SELECT COALESCE(SUM(sales), 0) - COALESCE(SUM(cogs), 0) FROM store_monthly_sales WHERE m_date = m.month_date),
            'net_profit', (SELECT COALESCE(SUM(sales), 0) - COALESCE(SUM(cogs), 0) FROM store_monthly_sales WHERE m_date = m.month_date) - (SELECT COALESCE(SUM(expenses), 0) - COALESCE(SUM(other_income), 0) FROM store_monthly_expenses WHERE m_date = m.month_date),
            'profit', (SELECT COALESCE(SUM(sales), 0) - COALESCE(SUM(cogs), 0) FROM store_monthly_sales WHERE m_date = m.month_date) - (SELECT COALESCE(SUM(expenses), 0) - COALESCE(SUM(other_income), 0) FROM store_monthly_expenses WHERE m_date = m.month_date),
            'stores', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'store_id', asm.store_id,
                        'store_name', asm.store_name,
                        'revenue', COALESCE(sms.sales, 0),
                        'expenses', COALESCE(sme.expenses, 0),
                        'cogs', COALESCE(sms.cogs, 0),
                        'gross_profit', COALESCE(sms.sales, 0) - COALESCE(sms.cogs, 0),
                        'net_profit', COALESCE(sms.sales, 0) - COALESCE(sms.cogs, 0) - COALESCE(sme.expenses, 0) + COALESCE(sme.other_income, 0),
                        'profit', COALESCE(sms.sales, 0) - COALESCE(sms.cogs, 0) - COALESCE(sme.expenses, 0) + COALESCE(sme.other_income, 0),
                        'other_income', COALESCE(sme.other_income, 0),
                        'transactions', COALESCE(sms.transactions, 0)
                    )
                )
                FROM active_stores_per_month asm
                LEFT JOIN store_monthly_sales sms ON asm.store_id = sms.store_id AND asm.m_date = sms.m_date
                LEFT JOIN store_monthly_expenses sme ON asm.store_id = sme.store_id AND asm.m_date = sme.m_date
                WHERE asm.m_date = m.month_date
            )
        )
        ORDER BY m.month_date
    ) INTO v_result
    FROM months m;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;


GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_monthly_summary(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_financial_summary(INT, TEXT) TO authenticated;

COMMIT;
