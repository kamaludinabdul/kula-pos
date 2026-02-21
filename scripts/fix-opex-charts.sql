-- FIX: Update dashboard RPCs to correctly filter OPEX
-- The OPEX charts were including all 'out' cash flows (like COGS/Pembelian Stok) 
-- instead of only those marked as 'OPEX' in expense_category.

BEGIN;

-- 1. Fix get_dashboard_monthly_summary (Store Dashboard Chart)
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(UUID, INTEGER);

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
            COALESCE(SUM(t.total), 0) - COALESCE(SUM(
                (SELECT COALESCE(SUM((item->>'qty')::NUMERIC * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)), 0)
                 FROM jsonb_array_elements(t.items) as item)
            ), 0) as total_profit,
            COUNT(DISTINCT DATE(t.date)) as days_with_sales
        FROM transactions t
        WHERE t.store_id = p_store_id
          AND EXTRACT(YEAR FROM t.date) = p_year
          AND (t.status IS NULL OR t.status = 'completed')
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
            'totalProfit', COALESCE(md.total_profit, 0),
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
                THEN COALESCE(md.total_profit, 0) / md.days_with_sales 
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


-- 2. Fix get_owner_financial_summary (Owner Dashboard - Financials Chart)
DROP FUNCTION IF EXISTS public.get_owner_financial_summary(INT);
DROP FUNCTION IF EXISTS public.get_owner_financial_summary(INT, TEXT);

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
          AND t.status IN ('completed', 'paid')
          AND EXTRACT(YEAR FROM (t.date AT TIME ZONE p_timezone)) = p_year
        GROUP BY 1, 2, 3
    ),
    store_monthly_expenses AS (
        SELECT 
            date_trunc('month', cf.date)::DATE as m_date,
            cf.store_id,
            s.name as store_name,
            -- FIX: Only count OPEX group for the expenses chart to avoid double counting COGS
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
            'days_in_month', EXTRACT(DAY FROM (m.month_date + interval '1 month' - interval '1 day')),
            'revenue', (SELECT COALESCE(SUM(sales), 0) FROM store_monthly_sales WHERE m_date = m.month_date),
            'expenses', (SELECT COALESCE(SUM(expenses), 0) FROM store_monthly_expenses WHERE m_date = m.month_date),
            'active_days', (
                SELECT COUNT(DISTINCT (t.date AT TIME ZONE p_timezone)::date)
                FROM transactions t
                JOIN stores s ON t.store_id = s.id
                WHERE s.owner_id = v_owner_id
                  AND t.status IN ('completed', 'paid')
                  AND date_trunc('month', t.date AT TIME ZONE p_timezone)::DATE = m.month_date
            ),
            'profit', (
                SELECT COALESCE(SUM(sales), 0) - COALESCE(SUM(cogs), 0) 
                FROM store_monthly_sales WHERE m_date = m.month_date
            ) - (
                SELECT COALESCE(SUM(expenses), 0) - COALESCE(SUM(other_income), 0)
                FROM store_monthly_expenses WHERE m_date = m.month_date
            ),
            'stores', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'store_id', asm.store_id,
                        'store_name', asm.store_name,
                        'revenue', COALESCE(sms.sales, 0),
                        'expenses', COALESCE(sme.expenses, 0),
                        'cogs', COALESCE(sms.cogs, 0),
                        'active_days', COALESCE(sms.active_days, 0),
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

GRANT EXECUTE ON FUNCTION public.get_dashboard_monthly_summary(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_financial_summary(INT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
