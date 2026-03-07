-- MASTER: receive_purchase_order
-- Purpose: Process PO reception, update stock, and create FIFO batches

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
    p_store_id UUID,
    p_po_id UUID,
    p_items JSONB,
    p_po_updates JSONB
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item RECORD;
BEGIN
    UPDATE purchase_orders SET status = 'received', items = p_po_updates->'items', total_amount = (p_po_updates->>'totalAmount')::NUMERIC, updated_at = NOW() WHERE id = p_po_id AND store_id = p_store_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'PO not found'); END IF;
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x("productId" UUID, qty NUMERIC, "buyPrice" NUMERIC, "expiredDate" DATE)
    LOOP
        UPDATE products SET stock = stock + v_item.qty, buy_price = CASE WHEN v_item."buyPrice" > 0 THEN v_item."buyPrice" ELSE buy_price END, updated_at = NOW() WHERE id = v_item."productId" AND store_id = p_store_id;
        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id) VALUES (p_store_id, v_item."productId", 'in', v_item.qty, NOW(), 'Received from PO #' || right(p_po_id::text, 8), p_po_id::text);
        INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date) VALUES (p_store_id, v_item."productId", v_item.qty, v_item.qty, v_item."buyPrice", NOW(), 'PO Reception #' || right(p_po_id::text, 8), v_item."expiredDate");
    END LOOP;
    RETURN jsonb_build_object('success', true);
END;
$$;
