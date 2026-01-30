-- =============================================================================
-- KASIR PRO SUPABASE - OWNER FINANCIAL SUMMARY RPC
-- =============================================================================
-- This script creates the RPC function for the Monthly Financial Trends.
-- =============================================================================

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
    -- Get current user ID
    v_owner_id := auth.uid();
    
    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_array();
    END IF;
    
    -- Generate all months for the given year
    WITH months AS (
        SELECT (make_date(p_year, m, 1))::DATE as month_date
        FROM generate_series(1, 12) m
    ),
    -- Aggregate Sales and COGS from transactions
    monthly_sales AS (
        SELECT 
            date_trunc('month', t.date)::DATE as m_date,
            SUM(t.total) as sales,
            COUNT(*) as transactions,
            SUM((
                SELECT SUM(COALESCE((item->>'qty')::NUMERIC, 0) * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0))
                FROM jsonb_array_elements(t.items) as item
            )) as cogs
        FROM transactions t
        JOIN stores s ON t.store_id = s.id
        WHERE s.owner_id = v_owner_id
          AND t.status = 'completed'
          AND EXTRACT(YEAR FROM t.date) = p_year
        GROUP BY 1
    ),
    -- Aggregate Expenses and Income from cash_flow
    monthly_expenses AS (
        SELECT 
            date_trunc('month', cf.date)::DATE as m_date,
            SUM(CASE WHEN cf.type = 'expense' AND (cf.expense_group != 'asset' OR cf.expense_group IS NULL) THEN cf.amount ELSE 0 END) as expenses,
            SUM(CASE WHEN cf.type = 'income' THEN cf.amount ELSE 0 END) as other_income
        FROM cash_flow cf
        JOIN stores s ON cf.store_id = s.id
        WHERE s.owner_id = v_owner_id
          AND EXTRACT(YEAR FROM cf.date) = p_year
        GROUP BY 1
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'month', EXTRACT(MONTH FROM m.month_date),
            'month_name', to_char(m.month_date, 'Mon'),
            'revenue', COALESCE(s.sales, 0),
            'expenses', COALESCE(e.expenses, 0),
            'cogs', COALESCE(s.cogs, 0),
            'other_income', COALESCE(e.other_income, 0),
            'profit', COALESCE(s.sales, 0) - COALESCE(s.cogs, 0) - COALESCE(e.expenses, 0) + COALESCE(e.other_income, 0),
            'transactions', COALESCE(s.transactions, 0),
            'days_in_month', EXTRACT(DAY FROM (m.month_date + interval '1 month' - interval '1 day'))
        )
        ORDER BY m.month_date
    ) INTO v_result
    FROM months m
    LEFT JOIN monthly_sales s ON m.month_date = s.m_date
    LEFT JOIN monthly_expenses e ON m.month_date = e.m_date;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_owner_financial_summary(INT) TO authenticated;
