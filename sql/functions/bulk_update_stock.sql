-- MASTER: bulk_update_stock
-- Purpose: Update stock and prices for multiple products using barcode
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.bulk_update_stock(
    p_store_id UUID,
    p_updates JSONB
) RETURNS JSONB AS $$
DECLARE
    v_update JSONB;
    v_prod_id UUID;
    v_success_count INT := 0;
    v_not_found_count INT := 0;
BEGIN
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        -- Find product by barcode
        SELECT id INTO v_prod_id FROM products 
        WHERE store_id = p_store_id AND barcode = v_update->>'barcode' AND is_deleted = false;

        IF NOT FOUND THEN
            v_not_found_count := v_not_found_count + 1;
            CONTINUE;
        END IF;

        -- Update product stock and prices
        UPDATE products 
        SET stock = stock + (v_update->>'qty')::NUMERIC,
            buy_price = CASE WHEN (v_update->>'buyPrice')::NUMERIC > 0 THEN (v_update->>'buyPrice')::NUMERIC ELSE buy_price END,
            sell_price = CASE WHEN (v_update->>'sellPrice')::NUMERIC > 0 THEN (v_update->>'sellPrice')::NUMERIC ELSE sell_price END
        WHERE id = v_prod_id;

        -- Record movement
        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note)
        VALUES (p_store_id, v_prod_id, 'in', (v_update->>'qty')::NUMERIC, NOW(), COALESCE(v_update->>'note', 'Bulk Stock Update'));

        -- Compatibility: Create Batch if batches table exists
        BEGIN
            INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note)
            VALUES (p_store_id, v_prod_id, (v_update->>'qty')::NUMERIC, (v_update->>'qty')::NUMERIC, COALESCE((v_update->>'buyPrice')::NUMERIC, 0), NOW(), COALESCE(v_update->>'note', 'Bulk Stock Update'));
        EXCEPTION WHEN OTHERS THEN NULL; END;

        v_success_count := v_success_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'success_count', v_success_count,
        'not_found_count', v_not_found_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
