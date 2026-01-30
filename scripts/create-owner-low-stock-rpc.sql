-- =====================================================================================
-- KASIR PRO SUPABASE - OWNER LOW STOCK ALERTS RPC
-- =====================================================================================
-- This script adds an RPC to retrieve low stock products from all stores owned by a specific owner.
-- It bypasses standard RLS to allow "Aggregated Low Stock Notifications" feature.
-- =====================================================================================

-- 1. Create the RPC function
CREATE OR REPLACE FUNCTION public.get_owner_low_stock_alerts(p_owner_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    current_stock NUMERIC,
    minimum_stock NUMERIC,
    store_id UUID,
    store_name TEXT
)
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
        SELECT 
            p.id as product_id,
            p.name as product_name,
            p.stock as current_stock,
            p.min_stock as minimum_stock,
            s.id as store_id,
            s.name as store_name
        FROM public.products p
        JOIN public.stores s ON p.store_id = s.id
        WHERE s.owner_id = p_owner_id
          AND p.is_deleted = false
          AND p.stock <= p.min_stock
          AND p.min_stock > 0
        ORDER BY s.name, p.name;
    ELSE
        RAISE EXCEPTION 'Unauthorized: You do not have permission to access these alerts.';
    END IF;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_owner_low_stock_alerts(UUID) TO authenticated;

-- Add a comment for documentation
COMMENT ON FUNCTION public.get_owner_low_stock_alerts IS 'Retrieves low stock products from all stores owned by the specified owner_id.';
