-- MASTER: reduce_stock_fifo
-- Purpose: Reduces stock using First-In-First-Out (FIFO) logic across batches
-- Source: scripts/restore-all-inventory-rpcs.sql

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
    -- 1. Loop through available batches in FIFO order (oldest first)
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

    -- 2. Update global stock
    UPDATE public.products
    SET stock = stock - p_qty,
        updated_at = NOW()
    WHERE id = p_product_id AND store_id = p_store_id;

    -- 3. Record Movement
    INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note)
    VALUES (p_store_id, p_product_id, 'out', -p_qty, NOW(), p_note);

    RETURN jsonb_build_object('success', true, 'cogs', v_total_cogs, 'remaining_needed', v_remaining_qty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
