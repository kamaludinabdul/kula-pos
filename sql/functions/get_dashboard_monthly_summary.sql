DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(TEXT, INTEGER);

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
