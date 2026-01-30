-- =============================================================================
-- RPC: get_owner_dashboard_stats
-- Aggregates dashboard statistics from ALL stores owned by the calling user
-- =============================================================================

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_owner_dashboard_stats(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
