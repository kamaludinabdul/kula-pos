-- Create RPC for Dashboard Statistics
-- This function aggregates data on the server side to reduce network payload and client-side processing.

CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day' -- 'day' or 'hour' for chart grouping
) RETURNS JSONB AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_transactions INT := 0;
    v_avg_order NUMERIC := 0;
    v_chart_data JSONB;
    v_category_stats JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
BEGIN
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
    WHERE store_id = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date
      AND status IN ('completed', 'success'); -- Ensure we only count valid sales

    -- 2. Chart Data (Time Series)
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date_trunc('hour', date), 'HH24:00') as name,
                EXTRACT(HOUR FROM date) as hour,
                SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id 
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
                to_char(date, 'DD Mon') as name, -- e.g. "23 Jan"
                date_trunc('day', date) as date_val,
                SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id 
              AND date >= p_start_date 
              AND date <= p_end_date
              AND status IN ('completed', 'success')
            GROUP BY 1, 2
            ORDER BY 2
        ) stats;
    END IF;

    -- 3. Category Stats (From JSONB items)
    -- Requires unpacking the JSONB items array
    SELECT jsonb_agg(cat_stats) INTO v_category_stats
    FROM (
        SELECT 
            p.category, -- We might need to join with products if category name isn't in items, but let's assume we link via product_id or simple aggregation
            -- If items json doesn't have category, we rely on products table join.
            -- This query assumes we perform a join or the item json has it.
            -- Let's do a robust join with products table for accuracy.
            COALESCE(prod.category_id::text, 'Uncategorized') as category_id, -- Simplification
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as value
        FROM transactions t,
             jsonb_array_elements(items) as item
        LEFT JOIN products prod ON prod.id = (item->>'id')::UUID
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND t.status IN ('completed', 'success')
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 5
    ) cat_stats;
    
    -- Optimize Category Stats: The above might be slow with joins. 
    -- Alternative: Use category name from products if referenced, or just grouped by product logic.
    -- Let's retry a cleaner version returning simple names if possible.
    -- Note: 'categories' table has names. 
    
    SELECT jsonb_agg(dataset) INTO v_category_stats
    FROM (
        SELECT 
            COALESCE(c.name, 'Uncategorized') as name,
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as value
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON p.id = (item->>'id')::UUID
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id = p_store_id 
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
        WHERE t.store_id = p_store_id 
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
        WHERE store_id = p_store_id 
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
