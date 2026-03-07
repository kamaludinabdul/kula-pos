-- MASTER: reset_loyalty_points
-- Purpose: Reset all customers' loyalty points to 0 for a specific store
-- Source: scripts/add-loyalty-reset-rpc.sql

CREATE OR REPLACE FUNCTION public.reset_loyalty_points(
    p_store_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE public.customers
    SET loyalty_points = 0
    WHERE store_id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
