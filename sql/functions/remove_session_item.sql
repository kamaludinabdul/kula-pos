-- MASTER: remove_session_item
-- Purpose: Remove an item from a rental session and restore stock
-- Source: scripts/deploy_prod.sql

CREATE OR REPLACE FUNCTION public.remove_session_item(
    p_session_id UUID,
    p_store_id UUID,
    p_item_index INT
) RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_orders JSONB;
    v_target_item JSONB;
    v_product_id UUID;
    v_qty NUMERIC;
BEGIN
    SELECT * INTO v_session FROM rental_sessions WHERE id = p_session_id AND store_id = p_store_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found');
    END IF;

    v_orders := v_session.orders;
    
    IF p_item_index < 0 OR p_item_index >= jsonb_array_length(v_orders) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid item index');
    END IF;

    v_target_item := v_orders->p_item_index;
    v_product_id := (v_target_item->>'id')::UUID;
    v_qty := (v_target_item->>'qty')::NUMERIC;

    IF (v_target_item->>'stock_deducted')::BOOLEAN IS TRUE THEN
        UPDATE products 
        SET stock = stock + v_qty 
        WHERE id = v_product_id AND store_id = p_store_id;

        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
        VALUES (p_store_id, v_product_id, 'in', v_qty, NOW(), 'Restored from Service Session', p_session_id::TEXT);
    END IF;

    UPDATE rental_sessions
    SET orders = v_orders - p_item_index
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
