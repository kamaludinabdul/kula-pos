-- MASTER: get_owner_financial_summary
-- Purpose: Monthly financial summary with multi-store breakdown (Owner View)
-- Source: scripts/update_owner_rpcs_multistore.sql

CREATE OR REPLACE FUNCTION public.get_owner_financial_summary(p_year INT)
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
    -- Sales & COGS per store/month
    store_monthly_sales AS (
        SELECT 
            date_trunc('month', t.date)::DATE as m_date,
            t.store_id,
            s.name as store_name,
            SUM(t.total) as sales,
            COUNT(*) as transactions,
            COUNT(DISTINCT t.date::date) as active_days,
            SUM((
                SELECT SUM(COALESCE((item->>'qty')::NUMERIC, 0) * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0))
                FROM jsonb_array_elements(t.items) as item
            )) as cogs
        FROM transactions t
        JOIN stores s ON t.store_id = s.id
        WHERE s.owner_id = v_owner_id
          AND t.status IN ('completed', 'paid')
          AND EXTRACT(YEAR FROM t.date) = p_year
        GROUP BY 1, 2, 3
    ),
    -- Expenses per store/month
    store_monthly_expenses AS (
        SELECT 
            date_trunc('month', cf.date)::DATE as m_date,
            cf.store_id,
            s.name as store_name,
            SUM(CASE WHEN cf.type = 'expense' AND (cf.expense_group != 'asset' OR cf.expense_group IS NULL) THEN cf.amount ELSE 0 END) as expenses,
            SUM(CASE WHEN cf.type = 'income' THEN cf.amount ELSE 0 END) as other_income
        FROM cash_flow cf
        JOIN stores s ON cf.store_id = s.id
        WHERE s.owner_id = v_owner_id
          AND EXTRACT(YEAR FROM cf.date) = p_year
        GROUP BY 1, 2, 3
    ),
    -- Combined distinct list of stores involved in this month (sales OR expenses)
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
            -- Aggregated Totals
            'revenue', (SELECT COALESCE(SUM(sales), 0) FROM store_monthly_sales WHERE m_date = m.month_date),
            'expenses', (SELECT COALESCE(SUM(expenses), 0) FROM store_monthly_expenses WHERE m_date = m.month_date),
            'active_days', (
                -- Total distinct dates across ALL stores for this month
                SELECT COUNT(DISTINCT t.date::date)
                FROM transactions t
                JOIN stores s ON t.store_id = s.id
                WHERE s.owner_id = v_owner_id
                  AND t.status IN ('completed', 'paid')
                  AND date_trunc('month', t.date)::DATE = m.month_date
            ),
            'profit', (
                SELECT COALESCE(SUM(sales), 0) - COALESCE(SUM(cogs), 0) 
                FROM store_monthly_sales WHERE m_date = m.month_date
            ) - (
                SELECT COALESCE(SUM(expenses), 0) - COALESCE(SUM(other_income), 0)
                FROM store_monthly_expenses WHERE m_date = m.month_date
            ),
            -- Per Store Breakdown
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
