-- Remote Procedure Call for Server-Side Pagination of Products
CREATE OR REPLACE FUNCTION get_products_page(
    p_store_id UUID,
    p_page INT,
    p_page_size INT,
    p_search TEXT DEFAULT '',
    p_category TEXT DEFAULT 'all',
    p_satuan_po TEXT DEFAULT 'all',
    p_sort_key TEXT DEFAULT 'name',
    p_sort_dir TEXT DEFAULT 'asc'
)
RETURNS TABLE (
    data JSONB,
    total BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_offset INT;
    v_total BIGINT;
    v_products JSONB;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    -- 1. Calculate Total Count (Efficiently)
    SELECT COUNT(*)
    INTO v_total
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = p_store_id
    AND p.is_deleted = false
    AND (
        p_search = '' OR
        p.name ILIKE '%' || p_search || '%' OR
        p.barcode ILIKE '%' || p_search || '%'
    )
    AND (
        p_category = 'all' OR
        c.name = p_category
    )
    AND (
        p_satuan_po = 'all' OR
        (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR
        (p_satuan_po = 'no' AND p.purchase_unit IS NULL)
    );

    -- 2. Fetch Page Data
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'barcode', p.barcode,
            'buyPrice', p.buy_price,
            'sellPrice', p.sell_price,
            'stock', p.stock,
            'category', c.name,
            'unit', p.unit,
            'minStock', p.min_stock,
            'discount', p.discount,
            'discountType', p.discount_type,
            'isUnlimited', p.is_unlimited,
            'purchaseUnit', p.purchase_unit,
            'conversionToUnit', p.conversion_to_unit,
            'rackLocation', p.rack_location,
            'imageUrl', p.image_url,
            'pricingType', p.pricing_type,
            'pricingTiers', p.pricing_tiers,
            'isBundlingEnabled', p.is_bundling_enabled,
            'createdAt', p.created_at
        )
    )
    INTO v_products
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = p_store_id
    AND p.is_deleted = false
    AND (
        p_search = '' OR
        p.name ILIKE '%' || p_search || '%' OR
        p.barcode ILIKE '%' || p_search || '%'
    )
    AND (
        p_category = 'all' OR
        c.name = p_category
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
        -- Numeric sorts handled separately because CASE returns single type
        CASE WHEN p_sort_dir = 'asc' THEN
            CASE
                WHEN p_sort_key = 'stock' THEN p.stock
                WHEN p_sort_key = 'sellPrice' THEN p.sell_price
                WHEN p_sort_key = 'buyPrice' THEN p.buy_price
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
        p.created_at DESC -- Default tie breaker
    LIMIT p_page_size
    OFFSET v_offset;

    RETURN QUERY SELECT v_products, v_total;
END;
$$;
