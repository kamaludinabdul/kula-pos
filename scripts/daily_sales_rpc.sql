-- =============================================================================
-- KASIR PRO SUPABASE - OWNER DAILY SALES RPC
-- =============================================================================
-- This script creates the RPC function for the Daily Sales Line Chart.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_owner_daily_sales(p_days INT DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
    v_result JSONB;
BEGIN
    -- Get current user ID
    v_owner_id := auth.uid();
    
    IF v_owner_id IS NULL THEN
        RETURN jsonb_build_array();
    END IF;
    
    -- Generate dates for the period
    WITH date_series AS (
        SELECT generate_series(
            current_date - (p_days - 1),
            current_date,
            '1 day'::interval
        )::date as d_date
    ),
    -- Aggregate daily sales across all owned stores
    daily_stats AS (
        SELECT 
            t.date::date as s_date,
            SUM(t.total) as daily_total
        FROM transactions t
        JOIN stores s ON t.store_id = s.id
        WHERE s.owner_id = v_owner_id
          AND t.status = 'completed'
          AND t.date >= (current_date - (p_days - 1))
        GROUP BY 1
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', to_char(ds.d_date, 'DD Mon'),
            'full_date', ds.d_date,
            'total', COALESCE(ds_stats.daily_total, 0)
        )
        ORDER BY ds.d_date
    ) INTO v_result
    FROM date_series ds
    LEFT JOIN daily_stats ds_stats ON ds.d_date = ds_stats.s_date;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_owner_daily_sales(INT) TO authenticated;
