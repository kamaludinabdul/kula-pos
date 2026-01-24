-- Fix Dashboard RPC to accept TEXT IDs (NanoID support)
-- The 'stores' table seems to be using TEXT/VARCHAR ids (NanoID), but the RPC was expecting UUID.

-- Drop the old function first to change signature
DROP FUNCTION IF EXISTS get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_store_id TEXT, -- Changed from UUID to TEXT to support NanoID
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day'
) RETURNS JSONB AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_transactions INT := 0;
    v_avg_order NUMERIC := 0;
    v_chart_data JSONB;
    v_category_stats JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
    -- Variable for UUID cast if needed (not used if schema is TEXT)
    v_store_uuid UUID; 
BEGIN
    -- NOTE: In this environment, it seems 'stores.id' and 'transactions.store_id' are TEXT (NanoID).
    -- If they were UUID, we would need to cast p_store_id::UUID.
    -- But since we got "invalid input syntax for type uuid: 'ngT...'", the input is definitely NOT a UUID.
    -- Assuming the table columns are also TEXT/VARCHAR to match the input.
    -- If the table columns ARE UUID, then we have a bigger problem (client sending bad IDs), 
    -- but usually Supabase JS client sends what it gets.

    -- 1. General Stats (Totals)
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*),
        COALESCE(AVG(total), 0)
    INTO 
        v_total_sales,
        v_total_transactions,
        v_avg_order
    FROM transactions
    WHERE store_id::text = p_store_id -- Cast column to text just in case (safe comparison)
      AND date >= p_start_date 
      AND date <= p_end_date
      AND status IN ('completed', 'success');

    -- 2. Chart Data (Time Series)
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date_trunc('hour', date), 'HH24:00') as name,
                EXTRACT(HOUR FROM date) as hour,
                SUM(total) as total
            FROM transactions
            WHERE store_id::text = p_store_id 
              AND date >= p_start_date 
              AND date <= p_end_date
              AND status IN ('completed', 'success')
            GROUP BY 1, 2
            ORDER BY 2
        ) stats;
    ELSE
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date, 'DD Mon') as name,
                date_trunc('day', date) as date_val,
                SUM(total) as total
            FROM transactions
            WHERE store_id::text = p_store_id 
              AND date >= p_start_date 
              AND date <= p_end_date
              AND status IN ('completed', 'success')
            GROUP BY 1, 2
            ORDER BY 2
        ) stats;
    END IF;

    -- 3. Category Stats
    SELECT jsonb_agg(dataset) INTO v_category_stats
    FROM (
        SELECT 
            COALESCE(c.name, 'Uncategorized') as name,
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as value
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON p.id::text = (item->>'id') -- Compare as text
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id::text = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND t.status IN ('completed', 'success')
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 6
    ) dataset;

    -- 4. Top Selling Products
    SELECT jsonb_agg(top) INTO v_top_products
    FROM (
        SELECT 
            item->>'name' as name,
            SUM((item->>'qty')::numeric) as sold,
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as revenue
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        WHERE t.store_id::text = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND t.status IN ('completed', 'success')
        GROUP BY 1
        ORDER BY 3 DESC
        LIMIT 10
    ) top;

    -- 5. Recent Transactions
    SELECT jsonb_agg(recent) INTO v_recent_transactions
    FROM (
        SELECT id, cashier, date, total, status
        FROM transactions
        WHERE store_id::text = p_store_id 
          AND status IN ('completed', 'success')
        ORDER BY date DESC
        LIMIT 5
    ) recent;

    -- Return Consolidated Object
    RETURN jsonb_build_object(
        'totalSales', v_total_sales,
        'totalTransactions', v_total_transactions,
        'avgOrder', v_avg_order,
        'chartData', COALESCE(v_chart_data, '[]'::jsonb),
        'categoryData', COALESCE(v_category_stats, '[]'::jsonb),
        'topProducts', COALESCE(v_top_products, '[]'::jsonb),
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;
