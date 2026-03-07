-- MASTER: add_stock_batch
-- Purpose: Add stock with batch tracking, buy price update, and expiry date support

CREATE OR REPLACE FUNCTION public.add_stock_batch(
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_buy_price NUMERIC,
    p_sell_price NUMERIC,
    p_note TEXT DEFAULT '',
    p_expired_date DATE DEFAULT NULL
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch_id UUID;
BEGIN
    UPDATE products SET stock = stock + p_qty, buy_price = p_buy_price, sell_price = CASE WHEN p_sell_price > 0 THEN p_sell_price ELSE sell_price END, updated_at = NOW() WHERE id = p_product_id AND store_id = p_store_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Product not found'); END IF;
    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note) VALUES (p_store_id, p_product_id, 'in', p_qty, NOW(), COALESCE(p_note, 'Manual Addition'));
    INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date) VALUES (p_store_id, p_product_id, p_qty, p_qty, p_buy_price, NOW(), COALESCE(p_note, 'Manual Addition'), p_expired_date) RETURNING id INTO v_batch_id;
    RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id);
END;
$$;
