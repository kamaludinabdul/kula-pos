-- MASTER: get_profit_loss_report
-- Purpose: Laporan Laba Rugi (Profit & Loss)
-- Source: fix_dashboard_production.sql (Updated with Payment Method Breakdown)

CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
    v_total_sales NUMERIC;
    v_total_cogs NUMERIC;
    v_total_expenses NUMERIC; -- Operational (Cash)
    v_total_write_offs NUMERIC; -- Non-Cash
    v_other_income NUMERIC;
    v_total_assets NUMERIC;
    v_total_tax NUMERIC;
    v_total_discount NUMERIC;
    v_total_transactions INT;
    v_total_items INT;
    v_total_cash NUMERIC := 0;
    v_total_qris NUMERIC := 0;
    v_total_transfer NUMERIC := 0;
BEGIN
    -- 1. Calculate Sales, Tax, Discount, COGS, and Payment Method Breakdown
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(tax), 0),
        COALESCE(SUM(discount), 0),
        COUNT(*),
        COALESCE(SUM(jsonb_array_length(items)), 0),
        COALESCE(SUM((
            SELECT SUM(
                COALESCE((item->>'qty')::numeric, 0) * 
                COALESCE((item->>'buyPrice')::numeric, (item->>'buy_price')::numeric, 0)
            ) FROM jsonb_array_elements(t.items) as item
        )), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'cash' OR payment_method ILIKE 'tunai' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'qris' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'transfer' THEN total ELSE 0 END), 0)
    INTO 
        v_total_sales, v_total_tax, v_total_discount, v_total_transactions, v_total_items, v_total_cogs,
        v_total_cash, v_total_qris, v_total_transfer
    FROM transactions t
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND status IN ('completed', 'success', 'paid', 'paid_off');

    -- 2. Calculate Expenses (Grouped)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND type = 'out' 
      AND COALESCE(expense_group, 'operational') = 'operational';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_write_offs 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND type = 'out' 
      AND expense_group = 'write_off';

    SELECT COALESCE(SUM(amount), 0) INTO v_total_assets 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND type = 'out' 
      AND expense_group = 'asset';

    SELECT COALESCE(SUM(amount), 0) INTO v_other_income 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND type = 'in';

    RETURN jsonb_build_object(
        'total_sales', v_total_sales,
        'total_cogs', v_total_cogs,
        'total_expenses', v_total_expenses,
        'total_write_offs', v_total_write_offs,
        'other_income', v_other_income,
        'total_assets', v_total_assets,
        'total_tax', v_total_tax,
        'total_discount', v_total_discount,
        'total_transactions', v_total_transactions,
        'total_items', v_total_items,
        'total_cash', v_total_cash,
        'total_qris', v_total_qris,
        'total_transfer', v_total_transfer,
        'net_profit', v_total_sales - v_total_cogs - v_total_expenses - v_total_write_offs + v_other_income
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
