-- ============================================================
-- MEGA HOTFIX: Fix All Broken RPCs
-- Date: 2026-03-28
-- Fixes:
--   1. get_products_page: Signature mismatch (UUID vs TEXT) causing 404
--   2. get_transactions_report_stats: Jasa/Sewa detection broken because
--      transaction items JSON does NOT contain stockType field.
--      Must JOIN products table to get stock_type.
--   3. Pendapatan Barang > Total Pendapatan: revenueBarang was calculated
--      from item-level (qty * price), not capped by transaction total.
-- ============================================================

-- =============================================
-- PART 1: Fix get_products_page (404 Error)
-- =============================================
-- Problem: Frontend sends store_id as TEXT via safeSupabaseRpc,
-- but production function only has UUID signature.

DROP FUNCTION IF EXISTS public.get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_products_page(TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_products_page(TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_products_page(
    p_store_id TEXT,
    p_page INT,
    p_page_size INT,
    p_search TEXT DEFAULT '',
    p_category TEXT DEFAULT 'all',
    p_satuan_po TEXT DEFAULT 'all',
    p_stock_type TEXT DEFAULT 'all',
    p_sort_key TEXT DEFAULT 'name',
    p_sort_dir TEXT DEFAULT 'asc'
) RETURNS JSONB 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_offset INT;
    v_total BIGINT;
    v_products JSONB;
    v_store_uuid UUID;
BEGIN
    v_store_uuid := p_store_id::UUID;
    v_offset := (p_page - 1) * p_page_size;

    -- 1. Calculate Total Count
    SELECT COUNT(*)
    INTO v_total
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = v_store_uuid
    AND p.is_deleted = false
    AND (
        p_search = '' OR
        p.name ILIKE '%' || p_search || '%' OR
        p.barcode ILIKE '%' || p_search || '%'
    )
    AND (
        p_category = 'all' OR
        c.name = p_category OR
        p.category_id::text = p_category
    )
    AND (
        p_satuan_po = 'all' OR
        (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR
        (p_satuan_po = 'no' AND p.purchase_unit IS NULL)
    )
    AND (
        p_stock_type = 'all' OR
        p.stock_type = p_stock_type
    );

    -- 2. Fetch Page Data as JSONB
    SELECT jsonb_agg(row_to_json(products_data)::jsonb)
    INTO v_products
    FROM (
        SELECT 
            p.id,
            p.name,
            p.barcode,
            p.buy_price AS "buyPrice",
            p.sell_price AS "sellPrice",
            p.stock,
            c.name AS category,
            p.category_id AS "categoryId",
            p.unit,
            p.min_stock AS "minStock",
            p.discount,
            p.discount_type AS "discountType",
            p.is_unlimited AS "isUnlimited",
            p.purchase_unit AS "purchaseUnit",
            p.conversion_to_unit AS "conversionToUnit",
            p.rack_location AS "rackLocation",
            p.image_url AS "imageUrl",
            p.pricing_type AS "pricingType",
            p.pricing_tiers AS "pricingTiers",
            p.is_bundling_enabled AS "isBundlingEnabled",
            p.created_at AS "createdAt",
            p.stock_type AS "stockType",
            p.doctor_fee_type AS "doctorFeeType",
            p.doctor_fee_value AS "doctorFeeValue",
            p.overtime_hourly_penalty,
            p.overtime_trigger_hours,
            p.units,
            (p.sell_price - p.buy_price) AS profit
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.store_id = v_store_uuid
        AND p.is_deleted = false
        AND (
            p_search = '' OR
            p.name ILIKE '%' || p_search || '%' OR
            p.barcode ILIKE '%' || p_search || '%'
        )
        AND (
            p_category = 'all' OR
            c.name = p_category OR
            p.category_id::text = p_category
        )
        AND (
            p_satuan_po = 'all' OR
            (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR
            (p_satuan_po = 'no' AND p.purchase_unit IS NULL)
        )
        AND (
            p_stock_type = 'all' OR
            p.stock_type = p_stock_type
        )
        ORDER BY
            CASE WHEN p_sort_dir = 'asc' THEN
                CASE
                    WHEN p_sort_key = 'name' THEN p.name
                    WHEN p_sort_key = 'category' THEN c.name
                    ELSE NULL
                END
            END ASC,
            CASE WHEN p_sort_dir = 'desc' THEN
                CASE
                    WHEN p_sort_key = 'name' THEN p.name
                    WHEN p_sort_key = 'category' THEN c.name
                    ELSE NULL
                END
            END DESC,
            CASE WHEN p_sort_dir = 'asc' THEN
                CASE
                    WHEN p_sort_key = 'stock' THEN p.stock
                    WHEN p_sort_key = 'sellPrice' THEN p.sell_price
                    WHEN p_sort_key = 'buyPrice' THEN p.buy_price
                    WHEN p_sort_key = 'profit' THEN (p.sell_price - p.buy_price)
                    WHEN p_sort_key = 'discount' THEN p.discount
                    ELSE NULL
                END
            END ASC,
            CASE WHEN p_sort_dir = 'desc' THEN
                CASE
                    WHEN p_sort_key = 'stock' THEN p.stock
                    WHEN p_sort_key = 'sellPrice' THEN p.sell_price
                    WHEN p_sort_key = 'buyPrice' THEN p.buy_price
                    WHEN p_sort_key = 'profit' THEN (p.sell_price - p.buy_price)
                    WHEN p_sort_key = 'discount' THEN p.discount
                    ELSE NULL
                END
            END DESC,
            p.created_at DESC
        LIMIT p_page_size
        OFFSET v_offset
    ) products_data;

    RETURN jsonb_build_object(
        'data', COALESCE(v_products, '[]'::jsonb),
        'total', v_total,
        'page', p_page,
        'pageSize', p_page_size
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_products_page(TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- =============================================
-- PART 2: Fix get_transactions_report_stats
--         (Jasa/Sewa detection + revenue math)
-- =============================================
-- Problem: Transaction item JSON does NOT contain stockType field.
-- Solution: JOIN products table to get stock_type from the product master.

DROP FUNCTION IF EXISTS public.get_transactions_report_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_transactions_report_stats(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

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

    -- === STEP 2: Revenue breakout (Barang vs Jasa) ===
    -- JOIN products table to get stock_type since items JSON doesn't have it
    SELECT
        COALESCE(SUM(CASE WHEN LOWER(resolved_type) NOT IN ('jasa', 'sewa') THEN item_revenue ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN LOWER(resolved_type) IN ('jasa', 'sewa') THEN item_revenue ELSE 0 END), 0)
    INTO v_revenue_barang, v_revenue_jasa
    FROM (
        SELECT 
            COALESCE((item->>'qty')::NUMERIC, 1) * (
                COALESCE((item->>'price')::NUMERIC, (item->>'sellPrice')::NUMERIC, 0) 
                - COALESCE((item->>'discount')::NUMERIC, 0)
            ) as item_revenue,
            -- Resolve stock type: item JSON first, then products table fallback
            LOWER(COALESCE(
                NULLIF(item->>'stockType', ''),
                NULLIF(item->>'stock_type', ''),
                pr.stock_type,
                'Barang'
            )) as resolved_type
        FROM public.transactions t,
             jsonb_array_elements(
                CASE WHEN jsonb_typeof(t.items::jsonb) = 'array' THEN t.items::jsonb ELSE '[]'::jsonb END
             ) as item
        LEFT JOIN products pr ON pr.id::TEXT = (item->>'id')
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
                  CASE WHEN jsonb_typeof(t.items::jsonb) = 'array' THEN t.items::jsonb ELSE '[]'::jsonb END
                ) as sub_item
                LEFT JOIN products sub_pr ON sub_pr.id::TEXT = (sub_item->>'id')
                WHERE LOWER(COALESCE(sub_item->>'stockType', sub_item->>'stock_type', sub_pr.stock_type, 'Barang')) ILIKE ANY (
                  CASE 
                    WHEN p_stock_type_filter = 'Jasa' THEN ARRAY['%jasa%', '%sewa%']
                    ELSE ARRAY[LOWER(p_stock_type_filter)]
                  END
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

GRANT EXECUTE ON FUNCTION public.get_transactions_report_stats(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- =============================================
-- RELOAD
-- =============================================
NOTIFY pgrst, 'reload schema';

SELECT 'MEGA HOTFIX SUCCESS: get_products_page + get_transactions_report_stats fixed!' as status;
