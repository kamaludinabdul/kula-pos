-- MASTER: get_profit_loss_report
-- Purpose: Advanced Profit & Loss calculation including OPEX and Other Income

CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
    p_store_id TEXT,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS JSONB 
AS $$
DECLARE
    v_total_sales NUMERIC := 0; v_total_cogs NUMERIC := 0; v_total_discount NUMERIC := 0; v_total_tax NUMERIC := 0;
    v_total_transactions INTEGER := 0; v_total_items NUMERIC := 0; v_total_expenses NUMERIC := 0;
    v_other_income NUMERIC := 0; v_total_assets NUMERIC := 0; v_net_profit NUMERIC := 0;
    v_total_cash NUMERIC := 0; v_total_qris NUMERIC := 0; v_total_transfer NUMERIC := 0;
BEGIN
    SELECT 
        COALESCE(SUM(total), 0), 
        COALESCE(SUM(discount), 0), 
        COALESCE(SUM(tax), 0), 
        COUNT(*),
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'qris' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'transfer' THEN total ELSE 0 END), 0)
    INTO 
        v_total_sales, v_total_discount, v_total_tax, v_total_transactions,
        v_total_cash, v_total_qris, v_total_transfer
    FROM transactions 
    WHERE store_id::text = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date 
      AND (LOWER(status) IN ('completed', 'success', 'paid', 'berhasil') OR status IS NULL);

    WITH expanded_items AS (
        SELECT COALESCE((item->>'qty')::NUMERIC, 0) as q, COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c
        FROM transactions t, jsonb_array_elements(t.items) as item
        WHERE t.store_id::text = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date 
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
    )
    SELECT COALESCE(SUM(q), 0), COALESCE(SUM(q * c), 0) INTO v_total_items, v_total_cogs FROM expanded_items;

    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_expenses FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow UNION ALL SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf WHERE cf.store_id::text = p_store_id 
          AND cf.date >= p_start_date 
          AND cf.date <= p_end_date 
          AND cf.type IN ('out', 'expense') 
          AND cf.expense_group IN ('OPEX', 'operational', 'write_off');

    SELECT COALESCE(SUM(amount), 0) INTO v_other_income FROM cash_flow WHERE store_id::text = p_store_id AND date >= p_start_date AND date <= p_end_date AND type = 'income';
    SELECT COALESCE(SUM(amount), 0) INTO v_total_assets FROM cash_flow WHERE store_id::text = p_store_id AND date >= p_start_date AND date <= p_end_date AND expense_group = 'asset';

    v_net_profit := v_total_sales - v_total_cogs - v_total_expenses + v_other_income;

    RETURN jsonb_build_object(
        'total_sales', v_total_sales, 
        'total_cogs', v_total_cogs, 
        'total_expenses', v_total_expenses, 
        'other_income', v_other_income, 
        'net_profit', v_net_profit, 
        'total_transactions', v_total_transactions, 
        'total_items', v_total_items, 
        'total_tax', v_total_tax, 
        'total_discount', v_total_discount, 
        'total_assets', v_total_assets,
        'total_cash', v_total_cash,
        'total_qris', v_total_qris,
        'total_transfer', v_total_transfer
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
