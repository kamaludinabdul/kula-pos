-- Update bulk_add_products function to handle various field names
-- Fixes: duplicate check ignores deleted items, proper field mapping

DROP FUNCTION IF EXISTS bulk_add_products(UUID, JSONB);

CREATE OR REPLACE FUNCTION bulk_add_products(
    p_store_id UUID,
    p_products JSONB
) RETURNS JSONB AS $$
DECLARE
    v_product JSONB;
    v_cat_id UUID;
    v_new_prod_id UUID;
    v_added_count INT := 0;
    v_skipped_count INT := 0;
    v_new_cats_count INT := 0;
    v_buy_price NUMERIC;
    v_sell_price NUMERIC;
    v_stock NUMERIC;
    v_min_stock NUMERIC;
    v_barcode TEXT;
    v_category TEXT;
    v_name TEXT;
BEGIN
    FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
        -- Extract name
        v_name := v_product->>'name';
        IF v_name IS NULL OR v_name = '' THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Extract barcode
        v_barcode := NULLIF(TRIM(COALESCE(v_product->>'barcode', v_product->>'code', '')), '');

        -- Get buy price (try multiple field names)
        v_buy_price := COALESCE(
            NULLIF((v_product->>'buyPrice'), '')::NUMERIC,
            NULLIF((v_product->>'buy_price'), '')::NUMERIC,
            NULLIF((v_product->>'cost'), '')::NUMERIC,
            0
        );

        -- Get sell price (try multiple field names)
        v_sell_price := COALESCE(
            NULLIF((v_product->>'sellPrice'), '')::NUMERIC,
            NULLIF((v_product->>'sell_price'), '')::NUMERIC,
            NULLIF((v_product->>'price'), '')::NUMERIC,
            0
        );

        -- Get stock
        v_stock := COALESCE(NULLIF((v_product->>'stock'), '')::NUMERIC, 0);

        -- Get min stock
        v_min_stock := COALESCE(
            NULLIF((v_product->>'minStock'), '')::NUMERIC,
            NULLIF((v_product->>'min_stock'), '')::NUMERIC,
            0
        );

        -- Get category
        v_category := NULLIF(TRIM(v_product->>'category'), '');

        -- Check duplicate barcode (ONLY non-deleted products)
        IF v_barcode IS NOT NULL AND EXISTS (
            SELECT 1 FROM products 
            WHERE store_id = p_store_id 
            AND barcode = v_barcode 
            AND (is_deleted IS NULL OR is_deleted = false)
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Handle Category
        IF v_category IS NOT NULL THEN
            SELECT id INTO v_cat_id 
            FROM categories 
            WHERE store_id = p_store_id 
            AND LOWER(TRIM(name)) = LOWER(v_category);
            
            IF NOT FOUND THEN
                INSERT INTO categories (store_id, name) 
                VALUES (p_store_id, v_category) 
                RETURNING id INTO v_cat_id;
                v_new_cats_count := v_new_cats_count + 1;
            END IF;
        ELSE
            v_cat_id := NULL;
        END IF;

        -- Insert Product
        INSERT INTO products (
            store_id, category_id, name, barcode, buy_price, sell_price, stock, unit, min_stock, type, is_deleted
        ) VALUES (
            p_store_id,
            v_cat_id,
            v_name,
            v_barcode,
            v_buy_price,
            v_sell_price,
            v_stock,
            COALESCE(NULLIF(v_product->>'unit', ''), 'pcs'),
            v_min_stock,
            COALESCE(NULLIF(v_product->>'type', ''), 'product'),
            false
        ) RETURNING id INTO v_new_prod_id;

        v_added_count := v_added_count + 1;

        -- Initial Stock Tracking
        IF v_stock > 0 THEN
            INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_new_prod_id, 'in', v_stock, NOW(), 'Initial Stock (Bulk Import)', v_new_prod_id::TEXT);

            INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note)
            VALUES (p_store_id, v_new_prod_id, v_stock, v_stock, v_buy_price, NOW(), 'Initial Stock (Bulk Import)');
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'added_count', v_added_count,
        'skipped_count', v_skipped_count,
        'new_categories_count', v_new_cats_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
