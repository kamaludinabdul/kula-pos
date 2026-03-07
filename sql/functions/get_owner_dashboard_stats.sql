-- MASTER: get_owner_dashboard_stats
-- Purpose: Owner View Summary (Multi-store)
-- Source: fix_dashboard_production.sql

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
