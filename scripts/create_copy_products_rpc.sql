-- RPC: Copy Products to Another Store
-- Used for "Salin ke Toko" feature
-- Updated to use SECURITY DEFINER to bypass RLS when writing to target store
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
    -- 1. Security Check: Validate Ownership
    SELECT (role = 'super_admin') INTO v_is_super_admin FROM profiles WHERE id = auth.uid();
    
    SELECT EXISTS(SELECT 1 FROM stores WHERE id = p_target_store_id AND owner_id = auth.uid()) 
    INTO v_is_owner;

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
        -- 2. Check if product with same barcode already exists in target store
        IF EXISTS (
            SELECT 1 FROM products 
            WHERE store_id = p_target_store_id 
            AND barcode = v_product.barcode 
            AND is_deleted = false
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- 3. Handle Category Mapping
        v_target_category_id := NULL;
        IF v_product.category_id IS NOT NULL AND v_product.category_name IS NOT NULL THEN
            -- Check if category exists in target store
            SELECT id INTO v_target_category_id 
            FROM categories 
            WHERE store_id = p_target_store_id AND LOWER(name) = LOWER(v_product.category_name);

            -- If not found, create it
            IF v_target_category_id IS NULL THEN
                INSERT INTO categories (store_id, name)
                VALUES (p_target_store_id, v_product.category_name)
                RETURNING id INTO v_target_category_id;
            END IF;
        END IF;

        -- 4. Insert Product Copy
        -- Uses COALESCE for is_unlimited in case source was NULL (old data)
        INSERT INTO products (
            store_id, category_id, name, barcode, 
            buy_price, sell_price, stock, unit, 
            min_stock, type, image_url, description,
            discount, discount_type, is_unlimited,
            pricing_type, pricing_tiers, is_bundling_enabled,
            is_wholesale, rack_location, weight
        ) VALUES (
            p_target_store_id,
            v_target_category_id,
            v_product.name,
            v_product.barcode,
            v_product.buy_price,
            v_product.sell_price,
            0, -- Reset stock to 0 for copied product
            v_product.unit,
            v_product.min_stock,
            v_product.type,
            v_product.image_url,
            v_product.description,
            v_product.discount,
            v_product.discount_type,
            COALESCE(v_product.is_unlimited, false), -- Handle potentially null column
            v_product.pricing_type,
            v_product.pricing_tiers,
            v_product.is_bundling_enabled,
            v_product.is_wholesale,
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
