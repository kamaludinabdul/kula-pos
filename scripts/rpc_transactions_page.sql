-- ============================================================
-- PAGINASI TRANSAKSI RPC DENGAN STOCK TYPE FILTER
-- Date: 2026-03-28
-- ============================================================

DROP FUNCTION IF EXISTS public.get_transactions_page(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION public.get_transactions_page(
    p_store_id TEXT,
    p_start_date TEXT,
    p_end_date TEXT,
    p_search TEXT DEFAULT '',
    p_status_filter TEXT DEFAULT 'all',
    p_payment_method_filter TEXT DEFAULT 'all',
    p_stock_type_filter TEXT DEFAULT 'all',
    p_page INT DEFAULT 1,
    p_page_size INT DEFAULT 20
) RETURNS JSONB 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_ts TIMESTAMPTZ;
    v_end_ts TIMESTAMPTZ;
    v_offset INT;
    v_total BIGINT;
    v_data JSONB;
BEGIN
    v_start_ts := p_start_date::TIMESTAMPTZ;
    v_end_ts := p_end_date::TIMESTAMPTZ;
    v_offset := (p_page - 1) * p_page_size;

    -- 1. Create a CTE for the base filtered query to ensure counts and data match perfectly
    -- Note: We only use CTE for filtering IDs, not mapping, to avoid scoping issues.
    
    -- First, get the total count
    SELECT COUNT(DISTINCT t.id)
    INTO v_total
    FROM public.transactions t
    WHERE t.store_id::TEXT = p_store_id
      AND t.date >= v_start_ts
      AND t.date <= v_end_ts
      AND (
        p_search = '' OR 
        t.id::TEXT ILIKE '%' || p_search || '%' OR
        t.customer_name ILIKE '%' || p_search || '%'
      )
      AND (
        CASE 
          WHEN LOWER(p_status_filter) = 'all' THEN TRUE
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
              CASE WHEN jsonb_typeof(t.items::jsonb) = 'array' THEN t.items::jsonb ELSE '[]'::jsonb END
            ) as item
            LEFT JOIN products pr ON pr.id::TEXT = (item->>'id')
            WHERE LOWER(COALESCE(item->>'stockType', item->>'stock_type', pr.stock_type, 'Barang')) ILIKE ANY (
              CASE 
                WHEN p_stock_type_filter = 'Jasa' THEN ARRAY['%jasa%', '%sewa%']
                ELSE ARRAY[LOWER(p_stock_type_filter)]
              END
            )
          )
        END
      );

    -- Second, get the actual paginated data
    SELECT jsonb_agg(row_to_json(tx_data)::jsonb)
    INTO v_data
    FROM (
        SELECT 
            t.*,
            p.name as cashier
        FROM public.transactions t
        LEFT JOIN public.profiles p ON p.id = t.cashier_id
        WHERE t.store_id::TEXT = p_store_id
          AND t.date >= v_start_ts
          AND t.date <= v_end_ts
          AND (
            p_search = '' OR 
            t.id::TEXT ILIKE '%' || p_search || '%' OR
            t.customer_name ILIKE '%' || p_search || '%'
          )
          AND (
            CASE 
              WHEN LOWER(p_status_filter) = 'all' THEN TRUE
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
                  CASE WHEN jsonb_typeof(t.items::jsonb) = 'array' THEN t.items::jsonb ELSE '[]'::jsonb END
                ) as item
                LEFT JOIN products pr ON pr.id::TEXT = (item->>'id')
                WHERE LOWER(COALESCE(item->>'stockType', item->>'stock_type', pr.stock_type, 'Barang')) ILIKE ANY (
                  CASE 
                    WHEN p_stock_type_filter = 'Jasa' THEN ARRAY['%jasa%', '%sewa%']
                    ELSE ARRAY[LOWER(p_stock_type_filter)]
                  END
                )
              )
            END
          )
        ORDER BY t.date DESC
        LIMIT p_page_size
        OFFSET v_offset
    ) tx_data;

    RETURN jsonb_build_object(
        'data', COALESCE(v_data, '[]'::jsonb),
        'total', v_total
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_transactions_page(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, INT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
