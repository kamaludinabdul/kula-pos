-- Fix: Remove 'description' column reference (doesn't exist in table)

DROP FUNCTION IF EXISTS copy_products_to_store(UUID, UUID, UUID[]);

CREATE OR REPLACE FUNCTION copy_products_to_store(
    p_source_store_id UUID,
    p_target_store_id UUID,
    p_product_ids UUID[]
) RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_target_category_id UUID;
    v_copied_count INT := 0;
    v_skipped_count INT := 0;
BEGIN
    -- Loop through products (removed 'description' from SELECT)
    FOR v_product IN 
        SELECT p.id, p.name, p.barcode, p.buy_price, p.sell_price, p.unit, 
               p.min_stock, p.type, p.image_url, p.category_id,
               c.name as category_name 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ANY(p_product_ids) 
          AND p.store_id = p_source_store_id
          AND p.is_deleted = false
    LOOP
        -- Skip if barcode exists in target
        IF v_product.barcode IS NOT NULL AND v_product.barcode != '' AND EXISTS (
            SELECT 1 FROM products 
            WHERE store_id = p_target_store_id 
            AND barcode = v_product.barcode 
            AND is_deleted = false
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Category Mapping
        v_target_category_id := NULL;
        IF v_product.category_name IS NOT NULL THEN
            SELECT id INTO v_target_category_id 
            FROM categories 
            WHERE store_id = p_target_store_id 
              AND LOWER(name) = LOWER(v_product.category_name);
            
            IF v_target_category_id IS NULL THEN
                INSERT INTO categories (store_id, name) 
                VALUES (p_target_store_id, v_product.category_name) 
                RETURNING id INTO v_target_category_id;
            END IF;
        END IF;

        -- Insert Product (removed 'description')
        INSERT INTO products (
            store_id, category_id, name, barcode, 
            buy_price, sell_price, stock, unit, 
            min_stock, type, image_url
        ) VALUES (
            p_target_store_id,
            v_target_category_id,
            v_product.name,
            v_product.barcode,
            COALESCE(v_product.buy_price, 0),
            COALESCE(v_product.sell_price, 0),
            0,
            v_product.unit,
            COALESCE(v_product.min_stock, 0),
            COALESCE(v_product.type, 'product'),
            v_product.image_url
        );

        v_copied_count := v_copied_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'copiedCount', v_copied_count, 
        'skippedCount', v_skipped_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
