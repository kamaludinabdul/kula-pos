-- FINAL FIX: Copy Products RPC
-- Removes references to columns that do not exist in some versions of the schema (description, is_wholesale).

CREATE OR REPLACE FUNCTION copy_products_to_store(
    p_source_store_id UUID,
    p_target_store_id UUID,
    p_product_ids UUID[]
) RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_new_category_id UUID;
    v_target_category_id UUID;
    v_copied_count INT := 0;
    v_skipped_count INT := 0;
    v_source_category_name TEXT;
    v_is_super_admin BOOLEAN;
    v_is_owner BOOLEAN;
BEGIN
    -- 1. Security Check
    SELECT (role = 'super_admin') INTO v_is_super_admin FROM profiles WHERE id = auth.uid();
    SELECT EXISTS(SELECT 1 FROM stores WHERE id = p_target_store_id AND owner_id = auth.uid()) INTO v_is_owner;

    IF NOT v_is_super_admin AND NOT v_is_owner THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Anda bukan pemilik toko tujuan.');
    END IF;

    -- Loop through each selected product ID
    FOR v_product IN 
        SELECT p.*, c.name as category_name 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ANY(p_product_ids) AND p.store_id = p_source_store_id
    LOOP
        -- 2. Check duplicate (By Barcode)
        IF v_product.barcode IS NOT NULL AND v_product.barcode <> '' THEN
            IF EXISTS (
                SELECT 1 FROM products 
                WHERE store_id = p_target_store_id 
                AND barcode = v_product.barcode 
                AND is_deleted = false
            ) THEN
                v_skipped_count := v_skipped_count + 1;
                CONTINUE;
            END IF;
        END IF;

        -- 3. Handle Category Mapping
        v_target_category_id := NULL;
        IF v_product.category_id IS NOT NULL AND v_product.category_name IS NOT NULL THEN
            SELECT id INTO v_target_category_id 
            FROM categories 
            WHERE store_id = p_target_store_id AND LOWER(name) = LOWER(v_product.category_name);

            IF v_target_category_id IS NULL THEN
                INSERT INTO categories (store_id, name)
                VALUES (p_target_store_id, v_product.category_name)
                RETURNING id INTO v_target_category_id;
            END IF;
        END IF;

        -- 4. Insert Product Copy
        -- Only use columns that are known to exist and are essential
        -- description and is_wholesale are REMOVED to avoid "column does not exist" errors
        INSERT INTO products (
            store_id, category_id, name, barcode, 
            buy_price, sell_price, stock, unit, 
            min_stock, type, image_url,
            discount, discount_type, is_unlimited,
            pricing_type, pricing_tiers, is_bundling_enabled,
            rack_location, weight
        ) VALUES (
            p_target_store_id,
            v_target_category_id,
            v_product.name,
            v_product.barcode,
            COALESCE(v_product.buy_price, 0),
            COALESCE(v_product.sell_price, 0),
            0, -- Reset stock
            v_product.unit,
            COALESCE(v_product.min_stock, 0),
            COALESCE(v_product.type, 'product'),
            v_product.image_url,
            COALESCE(v_product.discount, 0),
            COALESCE(v_product.discount_type, 'percent'),
            COALESCE(v_product.is_unlimited, false),
            COALESCE(v_product.pricing_type, 'standard'),
            COALESCE(v_product.pricing_tiers, '[]'::jsonb),
            COALESCE(v_product.is_bundling_enabled, false),
            v_product.rack_location,
            v_product.weight
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
