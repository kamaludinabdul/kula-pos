-- ============================================================
-- HOTFIX: get_profit_loss_report 
-- Fixes UUID cast exception when items have non-UUID ids (e.g. Pet Hotel)
-- ============================================================

DROP FUNCTION IF EXISTS public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_profit_loss_report(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

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
    
    -- Payment Method Breakdowns
    v_total_cash NUMERIC := 0;
    v_total_qris NUMERIC := 0;
    v_total_transfer NUMERIC := 0;
    
    -- New: Revenue Splits
    v_revenue_barang NUMERIC := 0;
    v_revenue_jasa NUMERIC := 0;
BEGIN
    -- 1. Aggregate Sales, Discount, Tax, Transactions, and Payment Methods
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(discount), 0),
        COALESCE(SUM(tax), 0),
        COUNT(*),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'cash' OR payment_method ILIKE 'tunai' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'qris' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'transfer' THEN total ELSE 0 END), 0)
    INTO 
        v_total_sales, 
        v_total_discount, 
        v_total_tax, 
        v_total_transactions,
        v_total_cash,
        v_total_qris,
        v_total_transfer
    FROM transactions
    WHERE store_id::TEXT = p_store_id
      AND date >= p_start_date
      AND date <= p_end_date
      -- Liberal status matching
      AND (
          status ILIKE ANY (ARRAY['completed', 'success', 'paid', 'Lunas', 'Sukses', 'Berhasil', 'done', 'closed', 'sale', 'sold'])
          OR status IS NULL 
          OR status = ''
      )
      AND status NOT IN ('void', 'cancelled', 'refunded', 'batal', 'rejected');

    -- 2. Aggregate Items and COGS (Safely joining products)
    WITH expanded_items AS (
        SELECT 
            COALESCE((item->>'qty')::NUMERIC, 0) as q,
            -- Try camelCase first, fallback to snake_case if exist in older data
            COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c,
            COALESCE((item->>'price')::NUMERIC, (item->>'sellPrice')::NUMERIC, 0) as p,
            COALESCE((item->>'discount')::NUMERIC, 0) as disc,
            -- Safely extract stockType: from item JSON first, then try JOIN with products table avoiding invalid UUID casting
            COALESCE(item->>'stockType', item->>'stock_type', pr.stock_type, 'Barang') as s_type
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        -- FIX: Cast pr.id to TEXT before comparing to avoid UUID casting error on non-UUID product IDs (like custom Pet Hotel services)
        LEFT JOIN products pr ON pr.id::TEXT = (item->>'id')
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
        -- Pendapatan Jasa: jasa + sewa
        COALESCE(SUM(CASE WHEN LOWER(s_type) IN ('jasa', 'sewa') THEN q * (p - disc) ELSE 0 END), 0)
    INTO v_total_items, v_total_cogs, v_revenue_barang, v_revenue_jasa
    FROM expanded_items;

    -- 3. Aggregate OPEX dari cash_flow dan shift_movements
    SELECT COALESCE(SUM(amount::numeric), 0)
    INTO v_total_expenses
    FROM (
        SELECT date::TIMESTAMPTZ as tz_date, amount, store_id, type, expense_group FROM cash_flow
        UNION ALL
        SELECT date::TIMESTAMPTZ as tz_date, amount, store_id, type, expense_group FROM shift_movements
    ) cf
    WHERE cf.store_id::TEXT = p_store_id
      -- Keep timezone handling robust
      AND cf.tz_date >= p_start_date
      AND cf.tz_date <= p_end_date
      AND cf.type IN ('out', 'expense')
      AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational', 'write_off');

    -- 4. Aggregate from cash_flow (Other Income)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_other_income
    FROM cash_flow
    WHERE store_id::TEXT = p_store_id
      AND date::TIMESTAMPTZ >= p_start_date
      AND date::TIMESTAMPTZ <= p_end_date
      AND type = 'income';

    -- 5. Aggregate Capital Expenditure (Assets)
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_assets
    FROM cash_flow
    WHERE store_id::TEXT = p_store_id
      AND date::TIMESTAMPTZ >= p_start_date
      AND date::TIMESTAMPTZ <= p_end_date
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
        'total_assets', v_total_assets,
        'total_cash', v_total_cash,
        'total_qris', v_total_qris,
        'total_transfer', v_total_transfer,
        'revenue_barang', v_revenue_barang,
        'revenue_jasa', v_revenue_jasa
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
SELECT 'Berhasil mengupdate get_profit_loss_report (Fix UUID cast + Safe OPEX timezone)!' as status;
