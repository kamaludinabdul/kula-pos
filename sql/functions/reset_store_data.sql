-- MASTER: reset_store_data
-- Purpose: Emergency reset for all store transaction and inventory data
-- Source: scripts/restore-all-inventory-rpcs.sql

CREATE OR REPLACE FUNCTION public.reset_store_data(
    p_store_id UUID
) RETURNS JSONB AS $$
BEGIN
    -- 1. Delete all related operational data
    DELETE FROM public.transactions WHERE store_id = p_store_id;
    DELETE FROM public.stock_movements WHERE store_id = p_store_id;
    DELETE FROM public.batches WHERE store_id = p_store_id;
    DELETE FROM public.purchase_orders WHERE store_id = p_store_id;
    DELETE FROM public.loyalty_history WHERE store_id = p_store_id;
    DELETE FROM public.shift_movements WHERE store_id = p_store_id;
    DELETE FROM public.shifts WHERE store_id = p_store_id;
    DELETE FROM public.rental_sessions WHERE store_id = p_store_id;
    DELETE FROM public.bookings WHERE store_id = p_store_id;
    
    -- 2. Reset product stock and performance counters
    UPDATE public.products 
    SET stock = 0, sold = 0, revenue = 0 
    WHERE store_id = p_store_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
