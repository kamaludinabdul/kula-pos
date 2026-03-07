-- MASTER: bulk_add_products
-- Purpose: Import multiple products at once from JSON, handles auto-category creation
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.bulk_add_products(
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
BEGIN
    FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
        -- Check duplicate barcode
        IF v_product->>'barcode' IS NOT NULL AND EXISTS (
            SELECT 1 FROM products WHERE store_id = p_store_id AND barcode = v_product->>'barcode'
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Handle Category
        IF v_product->>'category' IS NOT NULL THEN
            SELECT id INTO v_cat_id FROM categories WHERE store_id = p_store_id AND LOWER(TRIM(name)) = LOWER(TRIM(v_product->>'category'));
            IF NOT FOUND THEN
                INSERT INTO categories (store_id, name) VALUES (p_store_id, TRIM(v_product->>'category')) RETURNING id INTO v_cat_id;
                v_new_cats_count := v_new_cats_count + 1;
            END IF;
        ELSE
            v_cat_id := NULL;
        END IF;

        -- Insert Product
        INSERT INTO products (
            store_id, category_id, name, barcode, buy_price, sell_price, stock, unit, min_stock, type
        ) VALUES (
            p_store_id,
            v_cat_id,
            v_product->>'name',
            v_product->>'barcode',
            (v_product->>'buyPrice')::NUMERIC,
            (v_product->>'sellPrice')::NUMERIC,
            (v_product->>'stock')::NUMERIC,
            v_product->>'unit',
            (v_product->>'minStock')::NUMERIC,
            COALESCE(v_product->>'type', 'product')
        ) RETURNING id INTO v_new_prod_id;

        v_added_count := v_added_count + 1;

        -- Initial Stock Tracking
        IF (v_product->>'stock')::NUMERIC > 0 THEN
            INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_new_prod_id, 'in', (v_product->>'stock')::NUMERIC, NOW(), 'Initial Stock (Bulk Import)', v_new_prod_id::TEXT);

            -- Compatibility: Create Batch if batches table exists
            BEGIN
                INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note)
                VALUES (p_store_id, v_new_prod_id, (v_product->>'stock')::NUMERIC, (v_product->>'stock')::NUMERIC, (v_product->>'buyPrice')::NUMERIC, NOW(), 'Initial Stock (Bulk Import)');
            EXCEPTION WHEN OTHERS THEN NULL; END;
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
