-- ============================================================
-- HOTFIX: get_transactions_report_stats
-- Date: 2026-03-28
-- Fixes: "relation base_transactions does not exist" crash.
--        The previous version used a CTE (base_transactions) in one 
--        SELECT, then tried to reference it in a *separate* SELECT.
--        PostgreSQL CTEs are scoped to a single statement only.
--        This fix combines everything into a single statement.
-- ============================================================

-- 1. CLEANUP: Drop all previous versions
DROP FUNCTION IF EXISTS public.get_transactions_report_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_transactions_report_stats(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- 2. CREATE: Fixed version - single statement aggregation
CREATE OR REPLACE FUNCTION public.get_transactions_report_stats(
    p_store_id TEXT,
    p_start_date TEXT,
    p_end_date TEXT,
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
    v_start_ts TIMESTAMPTZ;
    v_end_ts TIMESTAMPTZ;
    v_total_sales NUMERIC := 0;
    v_total_count INTEGER := 0;
    v_total_cash NUMERIC := 0;
    v_total_qris NUMERIC := 0;
    v_total_transfer NUMERIC := 0;
    v_revenue_barang NUMERIC := 0;
    v_revenue_jasa NUMERIC := 0;
BEGIN
    -- Explicit Casting
    v_start_ts := p_start_date::TIMESTAMPTZ;
    v_end_ts := p_end_date::TIMESTAMPTZ;

    -- === STEP 1: Aggregate transaction totals and payment breakdowns ===
    SELECT 
        COALESCE(SUM(t.total), 0),
        COUNT(*),
        COALESCE(SUM(CASE WHEN LOWER(t.payment_method) IN ('cash', 'tunai') THEN t.total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN LOWER(t.payment_method) = 'qris' THEN t.total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN LOWER(t.payment_method) = 'transfer' THEN t.total ELSE 0 END), 0)
    INTO 
        v_total_sales, v_total_count, v_total_cash, v_total_qris, v_total_transfer
    FROM public.transactions t
    WHERE t.store_id::TEXT = p_store_id
      AND t.date >= v_start_ts
      AND t.date <= v_end_ts
      -- Status Filter
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
      -- Stock Type Filter
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
      );

    -- === STEP 2: Revenue breakout (Barang vs Jasa) ===
    -- This is a SEPARATE statement that queries transactions directly,
    -- not referencing a CTE from a different statement.
    SELECT
        COALESCE(SUM(CASE WHEN s_type NOT ILIKE ANY (ARRAY['%jasa%', '%sewa%']) THEN q * (p - disc) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN s_type ILIKE ANY (ARRAY['%jasa%', '%sewa%']) THEN q * (p - disc) ELSE 0 END), 0)
    INTO v_revenue_barang, v_revenue_jasa
    FROM (
        SELECT 
            COALESCE((item->>'qty')::NUMERIC, 1) as q,
            COALESCE((item->>'price')::NUMERIC, (item->>'sellPrice')::NUMERIC, 0) as p,
            COALESCE((item->>'discount')::NUMERIC, 0) as disc,
            LOWER(COALESCE(item->>'stockType', item->>'stock_type', item->>'category', item->>'type', 'Barang')) as s_type
        FROM public.transactions t,
             jsonb_array_elements(
                CASE 
                  WHEN jsonb_typeof(t.items::jsonb) = 'array' THEN t.items::jsonb 
                  ELSE '[]'::jsonb 
                END
             ) as item
        WHERE t.store_id::TEXT = p_store_id
          AND t.date >= v_start_ts
          AND t.date <= v_end_ts
          -- Same filters as Step 1
          AND (
            CASE 
              WHEN LOWER(p_status_filter) = 'all' THEN 
                LOWER(COALESCE(t.status, '')) NOT IN ('void', 'cancelled', 'refunded', 'batal', 'rejected')
              ELSE LOWER(t.status) = LOWER(p_status_filter)
            END
          )
          AND (
            CASE 
              WHEN LOWER(p_payment_method_filter) = 'all' THEN TRUE
              ELSE LOWER(t.payment_method) = LOWER(p_payment_method_filter)
            END
          )
          AND (
            CASE
              WHEN LOWER(p_stock_type_filter) = 'all' THEN TRUE
              ELSE EXISTS (
                SELECT 1 FROM jsonb_array_elements(
                  CASE 
                    WHEN jsonb_typeof(t.items::jsonb) = 'array' THEN t.items::jsonb 
                    ELSE '[]'::jsonb 
                  END
                ) as sub_item
                WHERE (
                  LOWER(COALESCE(sub_item->>'stockType', sub_item->>'stock_type', sub_item->>'category', sub_item->>'type', 'Barang')) ILIKE ANY (
                    CASE 
                      WHEN p_stock_type_filter = 'Jasa' THEN ARRAY['%jasa%', '%sewa%']
                      ELSE ARRAY[LOWER(p_stock_type_filter)]
                    END
                  )
                )
              )
            END
          )
    ) breakout_items;

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

-- 3. PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_transactions_report_stats(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. RELOAD
NOTIFY pgrst, 'reload schema';

SELECT 'SUCCESS: get_transactions_report_stats fixed!' as status;
