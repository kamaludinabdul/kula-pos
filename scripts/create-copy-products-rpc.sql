-- =============================================================================
-- RPC: copy_products_to_store
-- Clones selected products from one store to another.
-- Handles category mapping/creation based on name.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.copy_products_to_store(
    p_source_store_id TEXT,
    p_target_store_id TEXT,
    p_product_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID;
    v_source_owner_id UUID;
    v_target_owner_id UUID;
    v_is_super_admin BOOLEAN;
    v_product_count INTEGER := 0;
    v_product_record RECORD;
    v_new_category_id TEXT;
BEGIN
    -- Get current user ID
    v_caller_id := auth.uid();
    
    IF v_caller_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Check super admin status
    SELECT (role = 'super_admin') INTO v_is_super_admin FROM profiles WHERE id = v_caller_id;

    -- Check owners
    SELECT owner_id INTO v_source_owner_id FROM stores WHERE id = p_source_store_id;
    SELECT owner_id INTO v_target_owner_id FROM stores WHERE id = p_target_store_id;
    
    -- Permission Check: User must own both stores OR be super admin
    IF NOT COALESCE(v_is_super_admin, false) THEN
        IF v_source_owner_id IS DISTINCT FROM v_caller_id OR v_target_owner_id IS DISTINCT FROM v_caller_id THEN
            RETURN json_build_object('success', false, 'error', 'Permission denied. You must own both stores.');
        END IF;
    END IF;

    -- Validate target store exists
    IF v_target_owner_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Target store not found.');
    END IF;

    -- Loop through products to copy
    FOR v_product_record IN 
        SELECT p.*, c.name as category_name 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.store_id = p_source_store_id AND p.id = ANY(p_product_ids)
    LOOP
        -- Handle Category Mapping by Name
        v_new_category_id := NULL;
        IF v_product_record.category_name IS NOT NULL THEN
            -- Find existing category in target store by exact name
            SELECT id INTO v_new_category_id FROM categories 
            WHERE store_id = p_target_store_id AND name = v_product_record.category_name;
            
            -- Create if doesn't exist
            IF v_new_category_id IS NULL THEN
                INSERT INTO categories (store_id, name)
                VALUES (p_target_store_id, v_product_record.category_name)
                RETURNING id INTO v_new_category_id;
            END IF;
        END IF;

        -- Insert Product (Clone)
        -- We reset stock to 0 in the target store for safety
        INSERT INTO products (
            store_id, 
            category_id, 
            name, 
            code, 
            type, 
            buy_price, 
            sell_price, 
            stock_type, 
            stock, 
            min_stock, 
            weight, 
            discount, 
            discount_type, 
            shelf, 
            image, 
            unit, 
            purchase_unit, 
            conversion_to_unit, 
            pricing_type, 
            is_unlimited, 
            is_bundling_enabled, 
            is_wholesale,
            overtime_hourly_penalty, 
            overtime_trigger_hours, 
            pricing_tiers
        ) VALUES (
            p_target_store_id, 
            v_new_category_id, 
            v_product_record.name, 
            v_product_record.code, 
            v_product_record.type, 
            v_product_record.buy_price, 
            v_product_record.sell_price, 
            v_product_record.stock_type, 
            0, 
            v_product_record.min_stock, 
            v_product_record.weight, 
            v_product_record.discount, 
            v_product_record.discount_type, 
            v_product_record.shelf, 
            v_product_record.image, 
            v_product_record.unit, 
            v_product_record.purchase_unit, 
            v_product_record.conversion_to_unit, 
            v_product_record.pricing_type, 
            v_product_record.is_unlimited, 
            v_product_record.is_bundling_enabled, 
            v_product_record.is_wholesale,
            v_product_record.overtime_hourly_penalty, 
            v_product_record.overtime_trigger_hours, 
            v_product_record.pricing_tiers
        );
        
        v_product_count := v_product_count + 1;
    END LOOP;

    RETURN json_build_object('success', true, 'copiedCount', v_product_count);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.copy_products_to_store(TEXT, TEXT, TEXT[]) TO authenticated;
