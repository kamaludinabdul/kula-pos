-- =============================================================================
-- KASIR PRO SUPABASE - OWNER DASHBOARD RPC FIX
-- =============================================================================
-- This script creates the missing RPC functions required for the Owner Dashboard.
-- Please run this in your Supabase SQL Editor.
-- =============================================================================

-- 1. Create get_owner_dashboard_stats
CREATE OR REPLACE FUNCTION public.get_owner_dashboard_stats(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
    v_user_id UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('error', 'Not authenticated');
    END IF;
    
    SELECT json_build_object(
        'totalSales', COALESCE(SUM(
            CASE WHEN t.status IN ('completed', 'paid') THEN t.total ELSE 0 END
        ), 0),
        'totalTransactions', COALESCE(COUNT(
            CASE WHEN t.status IN ('completed', 'paid') THEN 1 END
        ), 0),
        'avgOrder', CASE 
            WHEN COUNT(CASE WHEN t.status IN ('completed', 'paid') THEN 1 END) > 0 
            THEN COALESCE(SUM(CASE WHEN t.status IN ('completed', 'paid') THEN t.total ELSE 0 END), 0) 
                 / COUNT(CASE WHEN t.status IN ('completed', 'paid') THEN 1 END)
            ELSE 0 
        END,
        'storeBreakdown', (
            SELECT COALESCE(json_agg(store_data), '[]'::json)
            FROM (
                SELECT 
                    s.id as store_id,
                    s.name as store_name,
                    s.plan,
                    COALESCE(SUM(CASE WHEN tx.status IN ('completed', 'paid') THEN tx.total ELSE 0 END), 0) as total_sales,
                    COALESCE(COUNT(CASE WHEN tx.status IN ('completed', 'paid') THEN 1 END), 0) as total_transactions
                FROM stores s
                LEFT JOIN transactions tx ON tx.store_id = s.id 
                    AND tx.date >= p_start_date 
                    AND tx.date <= p_end_date
                WHERE s.owner_id = v_user_id
                GROUP BY s.id, s.name, s.plan
                ORDER BY total_sales DESC
            ) store_data
        ),
        'totalStores', (
            SELECT COUNT(*) FROM stores WHERE owner_id = v_user_id
        )
    ) INTO v_result
    FROM stores s
    LEFT JOIN transactions t ON t.store_id = s.id 
        AND t.date >= p_start_date 
        AND t.date <= p_end_date
    WHERE s.owner_id = v_user_id;
    
    RETURN v_result;
END;
$$;

-- 2. Create get_owner_low_stock_alerts
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_low_stock_alerts(UUID) TO authenticated;
