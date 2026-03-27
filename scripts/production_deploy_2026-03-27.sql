-- ============================================================
-- PRODUCTION DEPLOY - Kula POS v0.26.6
-- Date: 2026-03-27
-- Description: Fixes case-sensitive revenue split (Jasa/Sewa)
--              in get_profit_loss_report RPC
-- ============================================================
-- INSTRUCTIONS:
--   1. Open Supabase Dashboard > SQL Editor
--   2. Paste entire contents of this file
--   3. Click RUN
--   4. Verify: SELECT get_profit_loss_report(
--        '<your_store_id>',
--        '2026-03-01T00:00:00Z',
--        '2026-03-27T23:59:59Z'
--      );
-- ============================================================

-- Step 1: Drop existing function signatures
DROP FUNCTION IF EXISTS public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_profit_loss_report(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

-- Step 2: Create updated function
CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
    p_store_id TEXT,
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
    v_total_cash NUMERIC := 0;
    v_total_qris NUMERIC := 0;
    v_total_transfer NUMERIC := 0;
    v_revenue_barang NUMERIC := 0;
    v_revenue_jasa NUMERIC := 0;
BEGIN
    -- 1. Aggregate Sales, Discount, Tax, Transactions, Payment Methods
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(discount), 0),
        COALESCE(SUM(tax), 0),
        COUNT(*),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'cash' OR payment_method ILIKE 'tunai' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'qris' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'transfer' THEN total ELSE 0 END), 0)
    INTO 
        v_total_sales, v_total_discount, v_total_tax, v_total_transactions,
        v_total_cash, v_total_qris, v_total_transfer
    FROM transactions
    WHERE store_id::TEXT = p_store_id
      AND date >= p_start_date
      AND date <= p_end_date
      AND (
          status ILIKE ANY (ARRAY['completed', 'success', 'paid', 'Lunas', 'Sukses', 'Berhasil', 'done', 'closed', 'sale', 'sold'])
          OR status IS NULL 
          OR status = ''
      )
      AND status NOT IN ('void', 'cancelled', 'refunded', 'batal', 'rejected');

    -- 2. Aggregate Items, COGS, and Revenue Split (Case-Insensitive Jasa/Sewa)
    WITH expanded_items AS (
        SELECT 
            COALESCE((item->>'qty')::NUMERIC, 0) as q,
            COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c,
            COALESCE((item->>'price')::NUMERIC, (item->>'sellPrice')::NUMERIC, 0) as p,
            COALESCE((item->>'discount')::NUMERIC, 0) as disc,
            COALESCE(item->>'stockType', item->>'stock_type', pr.stock_type, 'Barang') as s_type
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        LEFT JOIN products pr 
            ON item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
            AND pr.id = (item->>'id')::UUID
        WHERE t.store_id::TEXT = p_store_id
          AND t.date >= p_start_date
          AND t.date <= p_end_date
          AND (
              t.status ILIKE ANY (ARRAY['completed', 'success', 'paid', 'Lunas', 'Sukses', 'Berhasil', 'done', 'closed', 'sale', 'sold'])
              OR t.status IS NULL 
              OR t.status = ''
          )
          AND t.status NOT IN ('void', 'cancelled', 'refunded', 'batal', 'rejected')
    )
    SELECT 
        COALESCE(SUM(q), 0), 
        COALESCE(SUM(q * c), 0),
        -- Pendapatan Barang: everything that is NOT jasa/sewa
        COALESCE(SUM(CASE WHEN LOWER(s_type) IN ('jasa', 'sewa') THEN 0 ELSE q * (p - disc) END), 0),
        -- Pendapatan Jasa: jasa + sewa (case-insensitive)
        COALESCE(SUM(CASE WHEN LOWER(s_type) IN ('jasa', 'sewa') THEN q * (p - disc) ELSE 0 END), 0)
    INTO v_total_items, v_total_cogs, v_revenue_barang, v_revenue_jasa
    FROM expanded_items;

    -- 3. Aggregate OPEX (cash_flow + shift_movements)
    SELECT COALESCE(SUM(amount::numeric), 0)
    INTO v_total_expenses
    FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow
        UNION ALL
        SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf
    WHERE cf.store_id::TEXT = p_store_id
      AND cf.date >= p_start_date::DATE
      AND cf.date <= p_end_date::DATE
      AND cf.type IN ('out', 'expense')
      AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational', 'write_off');

    -- 4. Other Income
    SELECT COALESCE(SUM(amount), 0)
    INTO v_other_income
    FROM cash_flow
    WHERE store_id::TEXT = p_store_id
      AND date >= p_start_date::DATE
      AND date <= p_end_date::DATE
      AND type = 'income';

    -- 5. Capital Expenditure (Assets)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_assets
    FROM cash_flow
    WHERE store_id::TEXT = p_store_id
      AND date >= p_start_date::DATE
      AND date <= p_end_date::DATE
      AND expense_group = 'asset';

    -- 6. Net Profit
    v_net_profit := v_total_sales - v_total_cogs - v_total_expenses + v_other_income;

    -- 7. Return clean JSONB (no debug fields)
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
        'total_transfer', v_total_transfer,
        'revenue_barang', v_revenue_barang,
        'revenue_jasa', v_revenue_jasa
    );
END;
$$;

-- Step 3: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
