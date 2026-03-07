-- MASTER: get_owner_daily_sales
-- Purpose: Hourly/Daily sales chart for multi-store comparison (Owner View)
-- Source: scripts/update_owner_rpcs_multistore.sql

CREATE OR REPLACE FUNCTION public.get_owner_daily_sales(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_owner_id UUID;
    v_result JSONB;
BEGIN
    v_owner_id := auth.uid();
    IF v_owner_id IS NULL THEN RETURN jsonb_build_array(); END IF;
    
    IF p_period = 'hour' THEN
        -- Hourly breakdown for the specified range
        WITH date_series AS (
            SELECT generate_series(
                date_trunc('hour', p_start_date), 
                date_trunc('hour', p_end_date), 
                '1 hour'::interval
            ) as d_time
        ),
        hourly_store_sales AS (
            SELECT 
                date_trunc('hour', t.date) as s_time,
                t.store_id,
                s.name as store_name,
                SUM(t.total) as hourly_total
            FROM transactions t
            JOIN stores s ON t.store_id = s.id
            WHERE s.owner_id = v_owner_id
              AND t.status IN ('completed', 'paid')
              AND t.date >= p_start_date
              AND t.date <= p_end_date
            GROUP BY 1, 2, 3
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', to_char(ds.d_time, 'HH24:00'),
                'full_date', ds.d_time,
                'total', (
                    SELECT COALESCE(SUM(hourly_total), 0) 
                    FROM hourly_store_sales 
                    WHERE s_time = ds.d_time
                ),
                'stores', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'store_id', hss.store_id,
                            'store_name', hss.store_name,
                            'total', hss.hourly_total
                        )
                    )
                    FROM hourly_store_sales hss
                    WHERE hss.s_time = ds.d_time
                )
            )
            ORDER BY ds.d_time
        ) INTO v_result
        FROM date_series ds;
    ELSE
        -- Daily breakdown for the specified range
        WITH date_series AS (
            SELECT generate_series(
                date_trunc('day', p_start_date)::date, 
                date_trunc('day', p_end_date)::date, 
                '1 day'::interval
            )::date as d_date
        ),
        daily_store_sales AS (
            SELECT 
                t.date::date as s_date,
                t.store_id,
                s.name as store_name,
                SUM(t.total) as daily_total
            FROM transactions t
            JOIN stores s ON t.store_id = s.id
            WHERE s.owner_id = v_owner_id
              AND t.status IN ('completed', 'paid')
              AND t.date >= p_start_date
              AND t.date <= p_end_date
            GROUP BY 1, 2, 3
        )
        SELECT jsonb_agg(
            jsonb_build_object(
                'date', to_char(ds.d_date, 'DD Mon'),
                'full_date', ds.d_date,
                'total', (
                    SELECT COALESCE(SUM(daily_total), 0) 
                    FROM daily_store_sales 
                    WHERE s_date = ds.d_date
                ),
                'stores', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'store_id', dss.store_id,
                            'store_name', dss.store_name,
                            'total', dss.daily_total
                        )
                    )
                    FROM daily_store_sales dss
                    WHERE dss.s_date = ds.d_date
                )
            )
            ORDER BY ds.d_date
        ) INTO v_result
        FROM date_series ds;
    END IF;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
