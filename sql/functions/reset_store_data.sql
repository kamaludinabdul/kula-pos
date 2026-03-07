-- MASTER: reset_store_data
-- Purpose: EMERGENCY utility to wipe all transactional data for a store

CREATE OR REPLACE FUNCTION public.reset_store_data(
    p_store_id UUID
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM public.transactions WHERE store_id = p_store_id;
    DELETE FROM public.stock_movements WHERE store_id = p_store_id;
    DELETE FROM public.batches WHERE store_id = p_store_id;
    DELETE FROM public.purchase_orders WHERE store_id = p_store_id;
    DELETE FROM public.loyalty_history WHERE store_id = p_store_id;
    DELETE FROM public.shift_movements WHERE store_id = p_store_id;
    DELETE FROM public.shifts WHERE store_id = p_store_id;
    
    -- Reset product stock and counters
    UPDATE public.products 
    SET stock = 0, sold = 0, revenue = 0 
    WHERE store_id = p_store_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
