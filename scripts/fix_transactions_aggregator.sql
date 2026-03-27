-- ============================================================
-- TRANSACTIONS AGGREGATOR RPC v2.1 (ROBUST PATCH)
-- Date: 2026-03-28
-- Description: Adds case-insensitive checks and robust JSONB parsing
--              to ensure summary cards are never empty.
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
    -- 1. Create a temporary set of transactions (Base CTE)
    WITH base_transactions AS (
        SELECT t.id, t.total, t.payment_method, t.items
        FROM transactions t
        WHERE t.store_id::TEXT = p_store_id
          AND t.date >= p_start_date
          AND t.date <= p_end_date
          -- Status Filter (Case-Insensitive Robust Check)
          AND (
            CASE 
              WHEN LOWER(p_status_filter) = 'all' THEN 
                LOWER(COALESCE(t.status, '')) NOT IN ('void', 'cancelled', 'refunded', 'batal', 'rejected')
              ELSE LOWER(t.status) = LOWER(p_status_filter)
            END
          )
          -- Payment Method Filter
          AND (
            CASE 
              WHEN LOWER(p_payment_method_filter) = 'all' THEN TRUE
              ELSE LOWER(t.payment_method) = LOWER(p_payment_method_filter)
            END
          )
          -- Stock Type Filter (Check items)
          AND (
            CASE
              WHEN LOWER(p_stock_type_filter) = 'all' THEN TRUE
              ELSE EXISTS (
                SELECT 1 FROM jsonb_array_elements(
                  CASE 
                    WHEN jsonb_typeof(t.items::jsonb) = 'array' THEN t.items::jsonb 
                    ELSE '[]'::jsonb 
                  END
                ) as item
                WHERE (
                  LOWER(COALESCE(item->>'stockType', item->>'stock_type', item->>'category', item->>'type', 'Barang')) ILIKE ANY (
                    CASE 
                      WHEN p_stock_type_filter = 'Jasa' THEN ARRAY['%jasa%', '%sewa%']
                      ELSE ARRAY[LOWER(p_stock_type_filter)]
                    END
                  )
                )
              )
            END
          )
    )
    -- 2. Aggregate main stats
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'cash' OR payment_method ILIKE 'tunai' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'qris' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method ILIKE 'transfer' THEN total ELSE 0 END), 0)
    INTO 
        v_total_sales, v_total_count, v_total_cash, v_total_qris, v_total_transfer
    FROM base_transactions;

    -- 3. Break out revenue splits (Defensive JSONB parsing)
    WITH breakout_items AS (
        SELECT 
            COALESCE((item->>'qty')::NUMERIC, 1) as q,
            COALESCE((item->>'price')::NUMERIC, (item->>'sellPrice')::NUMERIC, 0) as p,
            COALESCE((item->>'discount')::NUMERIC, 0) as disc,
            LOWER(COALESCE(item->>'stockType', item->>'stock_type', item->>'category', item->>'type', 'Barang')) as s_type
        FROM base_transactions bt,
             jsonb_array_elements(
                CASE 
                  WHEN jsonb_typeof(bt.items::jsonb) = 'array' THEN bt.items::jsonb 
                  ELSE '[]'::jsonb 
                END
             ) as item
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

NOTIFY pgrst, 'reload schema';
