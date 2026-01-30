-- ==========================================
-- RPC: add_stock_batch
-- Description: Handles manual stock addition with FIFO support
-- Updates product stock, buy price, sell price, and logs movements/batches
-- ==========================================

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
    -- 1. Update Product Master
    UPDATE public.products
    SET stock = stock + p_qty,
        buy_price = p_buy_price,
        sell_price = CASE WHEN p_sell_price > 0 THEN p_sell_price ELSE sell_price END,
        updated_at = NOW()
    WHERE id = p_product_id AND store_id = p_store_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    -- 2. Record Stock Movement
    INSERT INTO public.stock_movements (
        store_id, 
        product_id, 
        type, 
        qty, 
        date, 
        note
    )
    VALUES (
        p_store_id,
        p_product_id,
        'in',
        p_qty,
        NOW(),
        COALESCE(p_note, 'Manual Stock Addition')
    );

    -- 3. Create Batch (for FIFO tracking)
    INSERT INTO public.batches (
        store_id, 
        product_id, 
        initial_qty, 
        current_qty, 
        buy_price, 
        date, 
        note
    )
    VALUES (
        p_store_id,
        p_product_id,
        p_qty,
        p_qty,
        p_buy_price,
        NOW(),
        COALESCE(p_note, 'Manual Stock Addition')
    )
    RETURNING id INTO v_batch_id;

    RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set search path for security
ALTER FUNCTION public.add_stock_batch(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) SET search_path = public;
