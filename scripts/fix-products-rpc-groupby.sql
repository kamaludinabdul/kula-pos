-- Fix get_products_page function to resolve GROUP BY error
-- This replaces any existing versions with a clean implementation

DROP FUNCTION IF EXISTS get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_products_page(
    p_store_id TEXT,
    p_page INT,
    p_page_size INT,
    p_search TEXT DEFAULT '',
    p_category TEXT DEFAULT 'all',
    p_satuan_po TEXT DEFAULT 'all',
    p_sort_key TEXT DEFAULT 'name',
    p_sort_dir TEXT DEFAULT 'asc'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_offset INT;
    v_total BIGINT;
    v_products JSONB;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    -- 1. Calculate Total Count
    SELECT COUNT(*)
    INTO v_total
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id::text = p_store_id
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
    );

    -- 2. Fetch Page Data - Build JSON directly in subquery
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
            (p.sell_price - p.buy_price) AS profit
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.store_id::text = p_store_id
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
                    ELSE NULL
                END
            END ASC,
            CASE WHEN p_sort_dir = 'desc' THEN
                CASE
                    WHEN p_sort_key = 'stock' THEN p.stock
                    WHEN p_sort_key = 'sellPrice' THEN p.sell_price
                    WHEN p_sort_key = 'buyPrice' THEN p.buy_price
                    WHEN p_sort_key = 'profit' THEN (p.sell_price - p.buy_price)
                    ELSE NULL
                END
            END DESC,
            p.created_at DESC
        LIMIT p_page_size
        OFFSET v_offset
    ) products_data;

    -- 3. Return combined result
    RETURN jsonb_build_object(
        'data', COALESCE(v_products, '[]'::jsonb),
        'total', v_total,
        'page', p_page,
        'pageSize', p_page_size
    );
END;
$$;
