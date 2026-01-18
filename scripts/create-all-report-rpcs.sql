-- =========================================================
-- CONSOLIDATED: ALL MISSING RPC FUNCTIONS FOR REPORTS
-- Run this in Supabase Production SQL Editor
-- =========================================================

-- ==============================
-- PART 1: get_profit_loss_report
-- ==============================
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
      AND status = 'completed';

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
          AND t.status = 'completed'
    )
    SELECT 
        COALESCE(SUM(q), 0), 
        COALESCE(SUM(q * c), 0)
    INTO v_total_items, v_total_cogs
    FROM expanded_items;

    -- Aggregate from cash_flow (Expenses)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_expenses
    FROM cash_flow
    WHERE store_id = p_store_id
      AND date >= p_start_date::DATE
      AND date <= p_end_date::DATE
      AND type = 'expense'
      AND (expense_group != 'asset' OR expense_group IS NULL);

    -- Aggregate from cash_flow (Other Income)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_other_income
    FROM cash_flow
    WHERE store_id = p_store_id
      AND date >= p_start_date::DATE
      AND date <= p_end_date::DATE
      AND type = 'income';

    -- Aggregate Capital Expenditure (Assets)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_assets
    FROM cash_flow
    WHERE store_id = p_store_id
      AND date >= p_start_date::DATE
      AND date <= p_end_date::DATE
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

-- ==============================
-- PART 2: get_product_sales_report
-- ==============================
DROP FUNCTION IF EXISTS public.get_product_sales_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_product_sales_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    product_id TEXT,
    product_name TEXT,
    category_name TEXT,
    total_qty NUMERIC,
    total_revenue NUMERIC,
    total_cogs NUMERIC,
    total_profit NUMERIC,
    transaction_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH sale_items AS (
        SELECT 
            t.id as trans_id,
            (item->>'id') as p_id,
            (item->>'name') as p_name,
            COALESCE((item->>'qty')::NUMERIC, 0) as q,
            COALESCE((item->>'price')::NUMERIC, 0) as p,
            COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id
          AND t.date >= p_start_date
          AND t.date <= p_end_date
          AND t.status = 'completed'
    )
    SELECT 
        s.p_id as product_id,
        s.p_name as product_name,
        COALESCE(cat.name, 'Tanpa Kategori') as category_name,
        SUM(s.q) as t_qty,
        SUM(s.q * s.p) as t_revenue,
        SUM(s.q * s.c) as t_cogs,
        SUM(s.q * (s.p - s.c)) as t_profit,
        COUNT(DISTINCT s.trans_id) as transaction_count
    FROM sale_items s
    LEFT JOIN products pr ON s.p_id = pr.id::TEXT
    LEFT JOIN categories cat ON pr.category_id = cat.id
    GROUP BY s.p_id, s.p_name, cat.name;
END;
$$;

-- ==============================
-- PART 3: Grant execute to users
-- ==============================
GRANT EXECUTE ON FUNCTION public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_sales_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Done!
SELECT 'RPC Functions Created Successfully!' as status;
