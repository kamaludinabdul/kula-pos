-- ============================================================
-- TRANSACTIONS AGGREGATOR RPC v2.4 (HOTFIX)
-- Date: 2026-03-28
-- Description: Uses ALL TEXT parameters for perfect PostgREST matching.
--              Fixed CTE scoping bug: base_transactions was defined in one 
--              CTE/SELECT but referenced from a separate SELECT statement,
--              which is illegal in PostgreSQL.
-- ============================================================

-- 1. CLEANUP: Drop all previous versions to avoid ambiguity
DROP FUNCTION IF EXISTS public.get_transactions_report_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_transactions_report_stats(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- 2. CREATE: Fixed version - no cross-statement CTE references
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

    -- === STEP 1: Aggregate transaction totals ===
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

-- 3. PERMISSIONS: Grant to all roles
GRANT EXECUTE ON FUNCTION public.get_transactions_report_stats(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. RELOAD: Flush schema cache
NOTIFY pgrst, 'reload schema';
