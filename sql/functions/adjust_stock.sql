-- MASTER: adjust_stock
-- Purpose: Manual stock adjustment (increments/decrements) with movement logging
-- Source: scripts/restore-all-inventory-rpcs.sql

CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_store_id UUID,
    p_product_id UUID,
    p_qty_change NUMERIC,
    p_type TEXT,
    p_note TEXT DEFAULT 'Manual Adjustment'
) RETURNS JSONB AS $$
BEGIN
    -- 1. Update Product Master
    UPDATE public.products
    SET stock = stock + p_qty_change,
        updated_at = NOW()
    WHERE id = p_product_id AND store_id = p_store_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    -- 2. Record Stock Movement
    INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note)
    VALUES (p_store_id, p_product_id, p_type, p_qty_change, NOW(), p_note);

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
