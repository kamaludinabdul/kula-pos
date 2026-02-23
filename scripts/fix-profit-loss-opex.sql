-- =========================================================================
-- FIX: get_profit_loss_report OPEX calculation
-- Menyamakan logika Biaya Operasional (OPEX) di Laba Rugi dengan Dashboard
-- =========================================================================

DROP FUNCTION IF EXISTS public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_cogs NUMERIC := 0;
    v_total_discount NUMERIC := 0;
    v_total_tax NUMERIC := 0;
    v_total_transactions INTEGER := 0;
    v_total_items NUMERIC := 0;
    v_total_expenses NUMERIC := 0;
    v_other_income NUMERIC := 0;
    v_total_assets NUMERIC := 0;
    v_net_profit NUMERIC := 0;
BEGIN
    -- Aggregate Sales, Discount, Tax, and Transactions
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(discount), 0),
        COALESCE(SUM(tax), 0),
        COUNT(*)
    INTO 
        v_total_sales, 
        v_total_discount, 
        v_total_tax, 
        v_total_transactions
    FROM transactions
    WHERE store_id = p_store_id
      AND date >= p_start_date
      AND date <= p_end_date
      AND status IN ('completed', 'success', 'paid');

    -- Aggregate Items and COGS
    WITH expanded_items AS (
        SELECT 
            COALESCE((item->>'qty')::NUMERIC, 0) as q,
            COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id
          AND t.date >= p_start_date
          AND t.date <= p_end_date
          AND t.status IN ('completed', 'success', 'paid')
    )
    SELECT 
        COALESCE(SUM(q), 0), 
        COALESCE(SUM(q * c), 0)
    INTO v_total_items, v_total_cogs
    FROM expanded_items;

    -- Aggregate OPEX dari cash_flow dan shift_movements
    SELECT COALESCE(SUM(amount::numeric), 0)
    INTO v_total_expenses
    FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow
        UNION ALL
        SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf
    WHERE cf.store_id = p_store_id
      AND cf.date >= p_start_date
      AND cf.date <= p_end_date
      AND cf.type IN ('out', 'expense')
      AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational');

    -- Aggregate Other Income dari cash_flow saja
    SELECT COALESCE(SUM(amount::numeric), 0)
    INTO v_other_income
    FROM cash_flow cf
    WHERE cf.store_id = p_store_id
      AND cf.date >= p_start_date
      AND cf.date <= p_end_date
      AND cf.type IN ('in', 'income')
      AND COALESCE(cf.expense_group, 'operational') != 'asset'; -- Pastikan bukan origin lain jika ada

    -- Aggregate Capital Expenditure (Assets) - Tetap hanya di cash_flow
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_assets
    FROM cash_flow
    WHERE store_id = p_store_id
      AND date >= p_start_date
      AND date <= p_end_date
      AND expense_group = 'asset';

    -- Calculate Net Profit
    v_net_profit := v_total_sales - v_total_cogs - v_total_expenses + v_other_income;

    -- Return as JSONB
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
        'total_assets', v_total_assets
    );
END;
$$;

-- Grant Permission and Reload Schema
GRANT EXECUTE ON FUNCTION public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
NOTIFY pgrst, 'reload schema';

SELECT 'Berhasil mengupdate get_profit_loss_report untuk OPEX' as status;
