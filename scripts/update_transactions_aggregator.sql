-- ============================================================
-- TRANSACTIONS AGGREGATOR RPC v2
-- Date: 2026-03-27
-- Description: Advanced summary for Transactions page with 
--              unlimited row support and full UI filter parity.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_transactions_report_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_transactions_report_stats(
    p_store_id TEXT,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_status_filter TEXT DEFAULT 'all',
    p_payment_method_filter TEXT DEFAULT 'all',
    p_stock_type_filter TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_count INTEGER := 0;
    v_total_cash NUMERIC := 0;
    v_total_qris NUMERIC := 0;
    v_total_transfer NUMERIC := 0;
    v_revenue_barang NUMERIC := 0;
    v_revenue_jasa NUMERIC := 0;
BEGIN
    -- 1. Create a temporary set of transactions that match Date, Status, Payment, and StockType filters
    WITH base_transactions AS (
        SELECT t.id, t.total, t.payment_method, t.items
        FROM transactions t
        WHERE t.store_id::TEXT = p_store_id
          AND t.date >= p_start_date
          AND t.date <= p_end_date
          -- Status Filter
          AND (
            CASE 
              WHEN p_status_filter = 'all' THEN 
                t.status NOT IN ('void', 'cancelled', 'refunded', 'batal', 'rejected') 
                OR t.status IS NULL OR t.status = ''
              ELSE t.status = p_status_filter
            END
          )
          -- Payment Method Filter
          AND (
            CASE 
              WHEN p_payment_method_filter = 'all' THEN TRUE
              ELSE t.payment_method ILIKE p_payment_method_filter
            END
          )
          -- Stock Type Filter (Check if transaction contains at least one item matching the type)
          AND (
            CASE
              WHEN p_stock_type_filter = 'all' THEN TRUE
              ELSE EXISTS (
                SELECT 1 FROM jsonb_array_elements(t.items) as item
                WHERE (
                  -- Robust Jasa/Sewa check matching Transactions.jsx logic
                  COALESCE(item->>'stockType', item->>'stock_type', item->>'category', item->>'type', 'Barang')::TEXT ILIKE ANY (
                    CASE 
                      WHEN p_stock_type_filter = 'Jasa' THEN ARRAY['%jasa%', '%sewa%']
                      ELSE ARRAY[p_stock_type_filter]
                    END
                  )
                )
              )
            END
          )
    )
    -- 2. Aggregate the main stats from matching transactions
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'cash' OR payment_method ILIKE 'tunai' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'qris' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'transfer' THEN total ELSE 0 END), 0)
    INTO 
        v_total_sales, v_total_count, v_total_cash, v_total_qris, v_total_transfer
    FROM base_transactions;

    -- 3. Break out revenue splits within these specific transactions
    WITH breakout_items AS (
        SELECT 
            COALESCE((item->>'qty')::NUMERIC, 1) as q,
            COALESCE((item->>'price')::NUMERIC, (item->>'sellPrice')::NUMERIC, 0) as p,
            COALESCE((item->>'discount')::NUMERIC, 0) as disc,
            COALESCE(item->>'stockType', item->>'stock_type', item->>'category', item->>'type', 'Barang') as s_type
        FROM base_transactions bt,
             jsonb_array_elements(bt.items) as item
    )
    SELECT
        COALESCE(SUM(CASE WHEN s_type ILIKE ANY (ARRAY['%jasa%', '%sewa%']) THEN 0 ELSE q * (p - disc) END), 0),
        COALESCE(SUM(CASE WHEN s_type ILIKE ANY (ARRAY['%jasa%', '%sewa%']) THEN q * (p - disc) ELSE 0 END), 0)
    INTO v_revenue_barang, v_revenue_jasa
    FROM breakout_items;

    RETURN jsonb_build_object(
        'revenue', v_total_sales,
        'count', v_total_count,
        'cash', v_total_cash,
        'qris', v_total_qris,
        'transfer', v_total_transfer,
        'revenueBarang', v_revenue_barang,
        'revenueJasa', v_revenue_jasa
    );
END;
$$;
