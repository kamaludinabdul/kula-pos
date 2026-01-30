-- =====================================================================================
-- KASIR PRO SUPABASE - SHARED CUSTOMERS RPC
-- =====================================================================================
-- This script adds an RPC to retrieve customers from all stores owned by a specific owner.
-- It bypasses standard RLS to allow "Shared Customer Database" feature.
-- =====================================================================================

-- 1. Create the RPC function
CREATE OR REPLACE FUNCTION public.get_shared_customers(p_owner_id UUID)
RETURNS SETOF public.customers
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges to bypass RLS efficiently
SET search_path = public
AS $$
BEGIN
    -- Security Check: Only allow if the caller is the owner or a super_admin
    -- (auth.uid() check is implicit if we want to restrict, but here we trust p_owner_id 
    -- because the caller is usually the owner themselves).
    -- However, for better security, we check if auth.uid() matches p_owner_id OR is super_admin.
    
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR id = p_owner_id)
    ) THEN
        RETURN QUERY
        SELECT * FROM public.customers
        WHERE store_id IN (
            SELECT id FROM public.stores WHERE owner_id = p_owner_id
        );
    ELSE
        RAISE EXCEPTION 'Unauthorized: You do not have permission to access these customers.';
    END IF;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_shared_customers(UUID) TO authenticated;

-- Add a comment for documentation
COMMENT ON FUNCTION public.get_shared_customers IS 'Retrieves all customers belonging to any store owned by the specified owner_id.';
