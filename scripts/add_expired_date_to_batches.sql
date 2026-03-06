-- Migration script to add expired_date to batches and update related RPCs

BEGIN;

-- 1. Add expired_date column to batches table
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS expired_date DATE;

-- Create an index to quickly find near-expiring batches
CREATE INDEX IF NOT EXISTS idx_batches_expired_date ON public.batches(expired_date);

-- 2. Update add_stock_batch RPC
CREATE OR REPLACE FUNCTION public.add_stock_batch(
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_buy_price NUMERIC,
    p_sell_price NUMERIC,
    p_note TEXT DEFAULT '',
    p_expired_date DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_batch_id UUID;
BEGIN
    UPDATE public.products
    SET stock = stock + p_qty,
        buy_price = p_buy_price,
        sell_price = CASE WHEN p_sell_price > 0 THEN p_sell_price ELSE sell_price END,
        updated_at = NOW()
    WHERE id = p_product_id AND store_id = p_store_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note)
    VALUES (p_store_id, p_product_id, 'in', p_qty, NOW(), COALESCE(p_note, 'Manual Stock Addition'));

    INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date)
    VALUES (p_store_id, p_product_id, p_qty, p_qty, p_buy_price, NOW(), COALESCE(p_note, 'Manual Stock Addition'), p_expired_date)
    RETURNING id INTO v_batch_id;

    RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update receive_purchase_order RPC parameter definition
-- Note: The parameter list for receive_purchase_order remains the same, 
-- but we extract expiredDate from the JSON objects in p_items.
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
    p_store_id UUID,
    p_po_id UUID,
    p_items JSONB,
    p_po_updates JSONB
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
BEGIN
    UPDATE public.purchase_orders
    SET status = 'received',
        items = p_po_updates->'items',
        total_amount = (p_po_updates->>'totalAmount')::NUMERIC,
        updated_at = NOW()
    WHERE id = p_po_id AND store_id = p_store_id;

    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'PO not found'); END IF;

    -- Extract expiredDate (DATE) from the jsonb
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x("productId" UUID, qty NUMERIC, "buyPrice" NUMERIC, "expiredDate" DATE)
    LOOP
        UPDATE public.products
        SET stock = stock + v_item.qty,
            buy_price = CASE WHEN v_item."buyPrice" > 0 THEN v_item."buyPrice" ELSE buy_price END,
            updated_at = NOW()
        WHERE id = v_item."productId" AND store_id = p_store_id;

        INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
        VALUES (p_store_id, v_item."productId", 'in', v_item.qty, NOW(), 'Received from PO #' || right(p_po_id::text, 8), p_po_id::text);

        INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date)
        VALUES (p_store_id, v_item."productId", v_item.qty, v_item.qty, v_item."buyPrice", NOW(), 'PO Reception #' || right(p_po_id::text, 8), v_item."expiredDate");
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reapply search_paths
ALTER FUNCTION public.add_stock_batch(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, DATE) SET search_path = public;
ALTER FUNCTION public.receive_purchase_order(UUID, UUID, JSONB, JSONB) SET search_path = public;

COMMIT;
