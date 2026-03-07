-- MASTER: create_initial_batch
-- Purpose: Assign an expiry date to existing stock without batch records
-- Source: scripts/create-initial-batch-rpc.sql

CREATE OR REPLACE FUNCTION public.create_initial_batch(
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_buy_price NUMERIC,
    p_expired_date DATE
) RETURNS JSONB AS $$
DECLARE
    v_batch_id UUID;
BEGIN
    -- Check if product exists and store_id matches
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND store_id = p_store_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    -- Create batch for existing stock
    INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date)
    VALUES (p_store_id, p_product_id, p_qty, p_qty, COALESCE(p_buy_price, 0), NOW(), 'Migrasi Stok Awal (Expired Tracking)', p_expired_date)
    RETURNING id INTO v_batch_id;

    RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
