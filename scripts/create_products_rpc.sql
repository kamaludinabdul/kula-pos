-- Create RPC for Server-Side Product Pagination

CREATE OR REPLACE FUNCTION get_products_page(
    p_store_id UUID,
    p_page INT,
    p_page_size INT,
    p_search TEXT DEFAULT '',
    p_category TEXT DEFAULT 'all',
    p_satuan_po TEXT DEFAULT 'all', -- 'all', 'yes', 'no'
    p_sort_key TEXT DEFAULT 'name', -- 'name', 'stock', 'buyPrice', 'sellPrice', 'category'
    p_sort_dir TEXT DEFAULT 'asc'
) RETURNS JSONB AS $$
DECLARE
    v_offset INT;
    v_total_items INT;
    v_products JSONB;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    -- 1. Calculate Total Count (for pagination)
    SELECT COUNT(*)
    INTO v_total_items
    FROM products p
    WHERE p.store_id = p_store_id
      AND p.is_deleted = FALSE
      AND (p_search = '' OR 
           p.name ILIKE '%' || p_search || '%' OR 
           p.barcode ILIKE '%' || p_search || '%')
      AND (p_category = 'all' OR 
           EXISTS (
               SELECT 1 FROM categories c 
               WHERE c.id = p.category_id 
               AND c.name ILIKE p_category
           ) OR
           p.category_id::text = p_category -- Handle if ID is passed
          )
      AND (p_satuan_po = 'all' OR 
           (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR
           (p_satuan_po = 'no' AND p.purchase_unit IS NULL));

    -- 2. Fetch Page Data
    -- We construct a dynamic query or just use standard SQL with cases for sorting
    SELECT jsonb_agg(data) INTO v_products
    FROM (
        SELECT 
            p.*,
            c.name as category_name,
            -- Add computed fields if needed
            (p.sell_price - p.buy_price) as profit
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.store_id = p_store_id
          AND p.is_deleted = FALSE
          AND (p_search = '' OR 
               p.name ILIKE '%' || p_search || '%' OR 
               p.barcode ILIKE '%' || p_search || '%')
          AND (p_category = 'all' OR 
               c.name ILIKE p_category OR
               p.category_id::text = p_category
              )
          AND (p_satuan_po = 'all' OR 
               (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR
               (p_satuan_po = 'no' AND p.purchase_unit IS NULL))
        ORDER BY 
            CASE WHEN p_sort_key = 'name' AND p_sort_dir = 'asc' THEN p.name END ASC,
            CASE WHEN p_sort_key = 'name' AND p_sort_dir = 'desc' THEN p.name END DESC,
            
            CASE WHEN p_sort_key = 'stock' AND p_sort_dir = 'asc' THEN p.stock END ASC,
            CASE WHEN p_sort_key = 'stock' AND p_sort_dir = 'desc' THEN p.stock END DESC,
            
            CASE WHEN p_sort_key = 'buyPrice' AND p_sort_dir = 'asc' THEN p.buy_price END ASC,
            CASE WHEN p_sort_key = 'buyPrice' AND p_sort_dir = 'desc' THEN p.buy_price END DESC,
            
            CASE WHEN p_sort_key = 'sellPrice' AND p_sort_dir = 'asc' THEN p.sell_price END ASC,
            CASE WHEN p_sort_key = 'sellPrice' AND p_sort_dir = 'desc' THEN p.sell_price END DESC,
            
            CASE WHEN p_sort_key = 'category' AND p_sort_dir = 'asc' THEN c.name END ASC,
            CASE WHEN p_sort_key = 'category' AND p_sort_dir = 'desc' THEN c.name END DESC,

            p.created_at DESC -- Default tie breaker
        LIMIT p_page_size
        OFFSET v_offset
    ) data;

    RETURN jsonb_build_object(
        'data', COALESCE(v_products, '[]'::jsonb),
        'total', v_total_items,
        'page', p_page,
        'pageSize', p_page_size
    );
END;
$$ LANGUAGE plpgsql;
