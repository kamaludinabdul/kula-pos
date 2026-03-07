-- MASTER: get_dashboard_monthly_summary
-- Purpose: Monthly summary chart for Store Dashboard
-- Source: scripts/deploy_prod.sql

CREATE OR REPLACE FUNCTION public.get_dashboard_monthly_summary(
    p_store_id UUID, p_year INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
    WITH monthly_data AS (
        SELECT EXTRACT(MONTH FROM t.date)::INTEGER as month_num, TO_CHAR(t.date, 'Mon') as month_name,
            COALESCE(SUM(t.total), 0) as total_revenue, COUNT(*) as transaction_count,
            COALESCE(SUM(t.total) - SUM(
                (SELECT COALESCE(SUM((item->>'qty')::NUMERIC * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)), 0)
                 FROM jsonb_array_elements(t.items) as item)
            ), 0) as total_profit,
            COUNT(DISTINCT DATE(t.date)) as days_with_sales
        FROM transactions t
        WHERE t.store_id = p_store_id AND EXTRACT(YEAR FROM t.date) = p_year AND (t.status IS NULL OR t.status = 'completed')
        GROUP BY EXTRACT(MONTH FROM t.date), TO_CHAR(t.date, 'Mon')
    ),
    monthly_expenses AS (
        SELECT EXTRACT(MONTH FROM cf.date)::INTEGER as month_num, COALESCE(SUM(cf.amount), 0) as total_opex
        FROM cash_flow cf
        WHERE cf.store_id = p_store_id AND EXTRACT(YEAR FROM cf.date) = p_year AND cf.type = 'out' AND (cf.expense_group IS NULL OR cf.expense_group != 'asset')
        GROUP BY EXTRACT(MONTH FROM cf.date)
    ),
    all_months AS (SELECT generate_series(1, 12) as month_num)
    SELECT jsonb_agg(
        jsonb_build_object(
            'monthIndex', am.month_num - 1,
            'name', TO_CHAR(DATE '2020-01-01' + ((am.month_num - 1) || ' month')::interval, 'Mon'),
            'totalRevenue', COALESCE(md.total_revenue, 0), 'totalProfit', COALESCE(md.total_profit, 0),
            'totalOpEx', COALESCE(me.total_opex, 0), 'transactionsCount', COALESCE(md.transaction_count, 0),
            'daysWithSales', COALESCE(md.days_with_sales, 0),
            'avgDailyRevenue', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN COALESCE(md.total_revenue, 0) / md.days_with_sales ELSE 0 END,
            'avgDailyProfit', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN COALESCE(md.total_profit, 0) / md.days_with_sales ELSE 0 END
        ) ORDER BY am.month_num
    ) INTO v_result
    FROM all_months am LEFT JOIN monthly_data md ON md.month_num = am.month_num LEFT JOIN monthly_expenses me ON me.month_num = am.month_num;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
