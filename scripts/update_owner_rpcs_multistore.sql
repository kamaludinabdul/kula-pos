-- =============================================================================
-- UPDATE: Owner Dashboard RPCs for Multi-Store Comparison
-- =============================================================================

-- 1. Updated RPC to support hourly/daily sales chart with multi-store breakdown
CREATE OR REPLACE FUNCTION public.get_owner_daily_sales(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day'
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
    
    IF p_period = 'hour' THEN
        -- Hourly breakdown for the specified range
        WITH date_series AS (
            SELECT generate_series(
                date_trunc('hour', p_start_date), 
                date_trunc('hour', p_end_date), 
                '1 hour'::interval
            ) as d_time
        ),
        hourly_store_sales AS (
            SELECT 
                date_trunc('hour', t.date) as s_time,
                t.store_id,
                s.name as store_name,
                SUM(t.total) as hourly_total
            FROM transactions t
            JOIN stores s ON t.store_id = s.id
            WHERE s.owner_id = v_owner_id
              AND t.status IN ('completed', 'paid')
              AND t.date >= p_start_date
              AND t.date <= p_end_date
            GROUP BY 1, 2, 3
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', to_char(ds.d_time, 'HH24:00'),
                'full_date', ds.d_time,
                'total', (
                    SELECT COALESCE(SUM(hourly_total), 0) 
                    FROM hourly_store_sales 
                    WHERE s_time = ds.d_time
                ),
                'stores', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'store_id', hss.store_id,
                            'store_name', hss.store_name,
                            'total', hss.hourly_total
                        )
                    )
                    FROM hourly_store_sales hss
                    WHERE hss.s_time = ds.d_time
                )
            )
            ORDER BY ds.d_time
        ) INTO v_result
        FROM date_series ds;
    ELSE
        -- Daily breakdown for the specified range
        WITH date_series AS (
            SELECT generate_series(
                date_trunc('day', p_start_date)::date, 
                date_trunc('day', p_end_date)::date, 
                '1 day'::interval
            )::date as d_date
        ),
        daily_store_sales AS (
            SELECT 
                t.date::date as s_date,
                t.store_id,
                s.name as store_name,
                SUM(t.total) as daily_total
            FROM transactions t
            JOIN stores s ON t.store_id = s.id
            WHERE s.owner_id = v_owner_id
              AND t.status IN ('completed', 'paid')
              AND t.date >= p_start_date
              AND t.date <= p_end_date
            GROUP BY 1, 2, 3
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', to_char(ds.d_date, 'DD Mon'),
                'full_date', ds.d_date,
                'total', (
                    SELECT COALESCE(SUM(daily_total), 0) 
                    FROM daily_store_sales 
                    WHERE s_date = ds.d_date
                ),
                'stores', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'store_id', dss.store_id,
                            'store_name', dss.store_name,
                            'total', dss.daily_total
                        )
                    )
                    FROM daily_store_sales dss
                    WHERE dss.s_date = ds.d_date
                )
            )
            ORDER BY ds.d_date
        ) INTO v_result
        FROM date_series ds;
    END IF;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 2. Update get_owner_financial_summary to return breakdown by store
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

GRANT EXECUTE ON FUNCTION public.get_owner_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_financial_summary(INT) TO authenticated;
