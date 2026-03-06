-- Add avgDailyGrossProfit to get_dashboard_monthly_summary
-- This adds the average daily gross profit (Revenue - COGS / active days)
-- without subtracting OpEx, giving a clearer picture of sales performance.

-- Drop BOTH versions to resolve ambiguity (PGRST203 error)
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_dashboard_monthly_summary(
    p_store_id TEXT,
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
            COALESCE(SUM( (SELECT COALESCE(SUM(COALESCE((item->>'qty')::NUMERIC, 0) * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)), 0) FROM jsonb_array_elements(t.items) as item) ), 0) as total_cogs,
            COUNT(DISTINCT DATE(t.date)) as days_with_sales
        FROM transactions t
        WHERE t.store_id = p_store_id::UUID
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
        WHERE cf.store_id = p_store_id::UUID
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
            'totalProfit', COALESCE(md.total_revenue, 0) - COALESCE(md.total_cogs, 0) - COALESCE(me.total_opex, 0),
            'totalOpEx', COALESCE(me.total_opex, 0),
            'transactionsCount', COALESCE(md.transaction_count, 0),
            'daysWithSales', COALESCE(md.days_with_sales, 0),
            'avgDailyRevenue', CASE 
                WHEN COALESCE(md.days_with_sales, 0) > 0 
                THEN COALESCE(md.total_revenue, 0) / md.days_with_sales 
                ELSE 0 
            END,
            'avgDailyGrossProfit', CASE 
                WHEN COALESCE(md.days_with_sales, 0) > 0 
                THEN (COALESCE(md.total_revenue, 0) - COALESCE(md.total_cogs, 0)) / md.days_with_sales 
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

GRANT EXECUTE ON FUNCTION public.get_dashboard_monthly_summary(TEXT, INTEGER) TO authenticated;
NOTIFY pgrst, 'reload schema';
