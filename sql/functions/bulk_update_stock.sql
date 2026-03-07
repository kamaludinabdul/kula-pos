-- MASTER: bulk_update_stock
-- Purpose: Optimized bulk stock update with FIFO-compatible batch creation

CREATE OR REPLACE FUNCTION public.bulk_update_stock(
    p_store_id UUID,
    p_updates JSONB
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_update RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_update IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(
        id UUID, 
        stock NUMERIC, 
        buy_price NUMERIC, 
        sell_price NUMERIC,
        expired_date DATE
    )
    LOOP
        -- Update global product stock
        UPDATE public.products
        SET stock = v_update.stock,
            buy_price = CASE WHEN v_update.buy_price > 0 THEN v_update.buy_price ELSE buy_price END,
            sell_price = CASE WHEN v_update.sell_price > 0 THEN v_update.sell_price ELSE sell_price END,
            updated_at = NOW()
        WHERE id = v_update.id AND store_id = p_store_id;

        -- Create a new batch for the updated stock
        IF v_update.stock > 0 THEN
            INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date)
            VALUES (p_store_id, v_update.id, v_update.stock, v_update.stock, v_update.buy_price, NOW(), 'Bulk Stock Update', v_update.expired_date);
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;
