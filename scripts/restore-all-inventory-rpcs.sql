-- ==========================================
-- UNIFIED INVENTORY RPCS RECOVERY SCRIPT
-- ==========================================
-- This script restores all missing RPCs related to Advanced Inventory (FIFO/Batches)
-- which were missing from the base v0.11.0 schema.

BEGIN;

-- 1. RPC: add_stock_batch
CREATE OR REPLACE FUNCTION public.add_stock_batch(
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_buy_price NUMERIC,
    p_sell_price NUMERIC,
    p_note TEXT DEFAULT ''
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

    INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note)
    VALUES (p_store_id, p_product_id, p_qty, p_qty, p_buy_price, NOW(), COALESCE(p_note, 'Manual Stock Addition'))
    RETURNING id INTO v_batch_id;

    RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: adjust_stock
CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_store_id UUID,
    p_product_id UUID,
    p_qty_change NUMERIC,
    p_type TEXT,
    p_note TEXT DEFAULT 'Manual Adjustment'
) RETURNS JSONB AS $$
BEGIN
    UPDATE public.products
    SET stock = stock + p_qty_change,
        updated_at = NOW()
    WHERE id = p_product_id AND store_id = p_store_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note)
    VALUES (p_store_id, p_product_id, p_type, p_qty_change, NOW(), p_note);

    -- Simple adjustment doesn't touch batches in this version, or uses latest batch
    -- For safety in FIFO, adjustments usually go to a special "adjustment" batch
    -- but here we follow the existing DataContext logic.

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: reduce_stock_fifo
CREATE OR REPLACE FUNCTION public.reduce_stock_fifo(
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_note TEXT DEFAULT 'Pengurangan Stok (FIFO)'
) RETURNS JSONB AS $$
DECLARE
    v_remaining_qty NUMERIC := p_qty;
    v_batch RECORD;
    v_total_cogs NUMERIC := 0;
    v_deduct_qty NUMERIC;
BEGIN
    -- Loop through available batches in FIFO order (oldest first)
    FOR v_batch IN 
        SELECT id, current_qty, buy_price 
        FROM public.batches 
        WHERE product_id = p_product_id AND store_id = p_store_id AND current_qty > 0 
        ORDER BY date ASC, created_at ASC
    LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;

        v_deduct_qty := LEAST(v_batch.current_qty, v_remaining_qty);
        
        UPDATE public.batches 
        SET current_qty = current_qty - v_deduct_qty 
        WHERE id = v_batch.id;

        v_total_cogs := v_total_cogs + (v_deduct_qty * v_batch.buy_price);
        v_remaining_qty := v_remaining_qty - v_deduct_qty;
    END LOOP;

    -- Update global stock
    UPDATE public.products
    SET stock = stock - p_qty,
        updated_at = NOW()
    WHERE id = p_product_id AND store_id = p_store_id;

    -- Record Movement
    INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note)
    VALUES (p_store_id, p_product_id, 'out', -p_qty, NOW(), p_note);

    RETURN jsonb_build_object('success', true, 'cogs', v_total_cogs, 'remaining_needed', v_remaining_qty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: receive_purchase_order (Ensuring quoted identifiers)
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

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x("productId" UUID, qty NUMERIC, "buyPrice" NUMERIC)
    LOOP
        -- Add stock batch naturally calls the RPC logic internally here
        UPDATE public.products
        SET stock = stock + v_item.qty,
            buy_price = CASE WHEN v_item."buyPrice" > 0 THEN v_item."buyPrice" ELSE buy_price END,
            updated_at = NOW()
        WHERE id = v_item."productId" AND store_id = p_store_id;

        INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
        VALUES (p_store_id, v_item."productId", 'in', v_item.qty, NOW(), 'Received from PO #' || right(p_po_id::text, 8), p_po_id::text);

        INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note)
        VALUES (p_store_id, v_item."productId", v_item.qty, v_item.qty, v_item."buyPrice", NOW(), 'PO Reception #' || right(p_po_id::text, 8));
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: reset_store_data (Emergency Reset)
CREATE OR REPLACE FUNCTION public.reset_store_data(
    p_store_id UUID
) RETURNS JSONB AS $$
BEGIN
    DELETE FROM public.transactions WHERE store_id = p_store_id;
    DELETE FROM public.stock_movements WHERE store_id = p_store_id;
    DELETE FROM public.batches WHERE store_id = p_store_id;
    DELETE FROM public.purchase_orders WHERE store_id = p_store_id;
    DELETE FROM public.loyalty_history WHERE store_id = p_store_id;
    DELETE FROM public.shift_movements WHERE store_id = p_store_id;
    DELETE FROM public.shifts WHERE store_id = p_store_id;
    DELETE FROM public.rental_sessions WHERE store_id = p_store_id;
    DELETE FROM public.bookings WHERE store_id = p_store_id;
    
    -- Reset product stock and counters
    UPDATE public.products 
    SET stock = 0, sold = 0, revenue = 0 
    WHERE store_id = p_store_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set Search Paths
ALTER FUNCTION public.add_stock_batch(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) SET search_path = public;
ALTER FUNCTION public.adjust_stock(UUID, UUID, NUMERIC, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.reduce_stock_fifo(UUID, UUID, NUMERIC, TEXT) SET search_path = public;
ALTER FUNCTION public.receive_purchase_order(UUID, UUID, JSONB, JSONB) SET search_path = public;
ALTER FUNCTION public.reset_store_data(UUID) SET search_path = public;

COMMIT;
