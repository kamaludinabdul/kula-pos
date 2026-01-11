-- Create RPC for resetting loyalty points
CREATE OR REPLACE FUNCTION public.reset_loyalty_points(
    p_store_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE public.customers
    SET loyalty_points = 0
    WHERE store_id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.reset_loyalty_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_loyalty_points(UUID) TO service_role;

-- Set search path for security
ALTER FUNCTION public.reset_loyalty_points(UUID) SET search_path = public;
