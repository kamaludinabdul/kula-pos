-- FIX TIMEZONE IN DASHBOARD RPCS (v2)
-- Adds p_timezone parameter to handle proper date truncation/extraction in local time.

BEGIN;

-- 1. Fix get_dashboard_stats (Store Dashboard)
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
    v_chart_data JSONB;
    v_category_stats JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
BEGIN
    -- 1. General Stats (Totals)
    -- Filtering is done by absolute TIMESTAMPTZ, so totals are correct for the requested range.
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

    -- 2. Chart Data (Timezone Sensitive)
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                -- Convert to local time, then format
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
        'chartData', COALESCE(v_chart_data, '[]'::jsonb),
        'categoryData', COALESCE(v_category_stats, '[]'::jsonb),
        'topProducts', COALESCE(v_top_products, '[]'::jsonb),
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;


-- 2. Fix get_owner_daily_sales (Owner Dashboard - Hourly/Daily Chart)
DROP FUNCTION IF EXISTS public.get_owner_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_owner_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_owner_daily_sales(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day',
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
    
    IF p_period = 'hour' THEN
        -- Hourly breakdown needs to generate series in LOCAL time, or construct labels correctly
        WITH date_series AS (
            SELECT generate_series(
                date_trunc('hour', p_start_date AT TIME ZONE p_timezone), 
                date_trunc('hour', p_end_date AT TIME ZONE p_timezone), 
                '1 hour'::interval
            ) as d_time_local
        ),
        hourly_store_sales AS (
            SELECT 
                date_trunc('hour', t.date AT TIME ZONE p_timezone) as s_time_local,
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
                'date', to_char(ds.d_time_local, 'HH24:00'),
                -- Convert back to ISO string for frontend if needed, but local usage is usually display only
                'full_date', ds.d_time_local, 
                'total', (
                    SELECT COALESCE(SUM(hourly_total), 0) 
                    FROM hourly_store_sales 
                    WHERE s_time_local = ds.d_time_local
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
                    WHERE hss.s_time_local = ds.d_time_local
                )
            )
            ORDER BY ds.d_time_local
        ) INTO v_result
        FROM date_series ds;
    ELSE
        -- Daily breakdown
        WITH date_series AS (
            SELECT generate_series(
                date_trunc('day', p_start_date AT TIME ZONE p_timezone), 
                date_trunc('day', p_end_date AT TIME ZONE p_timezone), 
                '1 day'::interval
            ) as d_date_local
        ),
        daily_store_sales AS (
            SELECT 
                date_trunc('day', t.date AT TIME ZONE p_timezone) as s_date_local,
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
                'date', to_char(ds.d_date_local, 'DD Mon'),
                'full_date', ds.d_date_local,
                'total', (
                    SELECT COALESCE(SUM(daily_total), 0) 
                    FROM daily_store_sales 
                    WHERE s_date_local = ds.d_date_local
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
                    WHERE dss.s_date_local = ds.d_date_local
                )
            )
            ORDER BY ds.d_date_local
        ) INTO v_result
        FROM date_series ds;
    END IF;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


-- 3. Fix get_owner_financial_summary (Owner Dashboard - Financials)
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
    -- Sales & COGS per store/month
    store_monthly_sales AS (
        SELECT 
            -- Group by Local Month
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
          -- Filter by Local Year
          AND EXTRACT(YEAR FROM (t.date AT TIME ZONE p_timezone)) = p_year
        GROUP BY 1, 2, 3
    ),
    -- Expenses per store/month
    store_monthly_expenses AS (
        SELECT 
            date_trunc('month', cf.date)::DATE as m_date, -- cf.date is usually just DATE, so ok
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
    -- Combined distinct list of stores
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
                -- Total distinct local dates across ALL stores for this month
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

-- Grant permissions needed
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_daily_sales(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_financial_summary(INT, TEXT) TO authenticated;

COMMIT;
