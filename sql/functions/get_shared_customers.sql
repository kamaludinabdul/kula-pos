-- MASTER: get_shared_customers
-- Purpose: Retrieves all customers belonging to any store owned by a specific owner
-- Source: scripts/create-shared-customers-rpc.sql

CREATE OR REPLACE FUNCTION public.get_shared_customers(p_owner_id UUID)
RETURNS SETOF public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Security Check: Only allow if the caller is the owner or a super_admin
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR id = p_owner_id)
    ) THEN
        RETURN QUERY
        SELECT c.*, s.name as branch_name
        FROM public.customers c
        JOIN public.stores s ON c.store_id = s.id
        WHERE c.store_id IN (
            SELECT id FROM public.stores WHERE owner_id = p_owner_id
        );
    ELSE
        RAISE EXCEPTION 'Unauthorized: You do not have permission to access these customers.';
    END IF;
END;
$$;
