-- MASTER: reset_loyalty_points
-- Purpose: Reset all customer loyalty points for a specific store

CREATE OR REPLACE FUNCTION public.reset_loyalty_points(
    p_store_id UUID
) RETURNS VOID 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN 
    UPDATE public.customers SET loyalty_points = 0 WHERE store_id = p_store_id; 
END;
$$;
