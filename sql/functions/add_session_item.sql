-- MASTER: add_session_item
-- Purpose: Add a product/service item to a rental/service session and deduct stock
-- Source: scripts/deploy_prod.sql

CREATE OR REPLACE FUNCTION public.add_session_item(
    p_session_id UUID,
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_price NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_product_name TEXT;
    v_new_item JSONB;
BEGIN
    SELECT name INTO v_product_name FROM products WHERE id = p_product_id AND store_id = p_store_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    UPDATE products 
    SET stock = stock - p_qty 
    WHERE id = p_product_id AND store_id = p_store_id;

    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
    VALUES (p_store_id, p_product_id, 'out', p_qty, NOW(), 'Used in Service Session', p_session_id::TEXT);

    v_new_item := jsonb_build_object(
        'id', p_product_id,
        'name', v_product_name,
        'qty', p_qty,
        'price', p_price,
        'stock_deducted', true,
        'added_at', NOW()
    );

    UPDATE rental_sessions
    SET orders = CASE 
        WHEN orders IS NULL THEN jsonb_build_array(v_new_item)
        ELSE orders || v_new_item
    END
    WHERE id = p_session_id AND store_id = p_store_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
