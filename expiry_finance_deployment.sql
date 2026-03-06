-- KULAPOS PRODUCTION DEPLOYMENT QUERIES
-- Focused on Expiry Management and Advanced Financial Reporting

-- 1. Table Updates (Idempotent)
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS expired_date DATE;
ALTER TABLE public.cash_flow ADD COLUMN IF NOT EXISTS expense_group TEXT DEFAULT 'operational';

-- 2. Index for Performance
CREATE INDEX IF NOT EXISTS idx_batches_expired_date ON public.batches(expired_date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_expense_group ON public.cash_flow(expense_group);

-- 3. Advanced Financial RPCs

-- RPC: get_profit_loss_report
-- Optimized for Dual Profit Metrics and Multi-Store Support
CREATE OR REPLACE FUNCTION get_profit_loss_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
    v_total_sales NUMERIC;
    v_total_cogs NUMERIC;
    v_total_expenses NUMERIC; -- Operational (Cash)
    v_total_write_offs NUMERIC; -- Non-Cash
    v_other_income NUMERIC;
    v_total_assets NUMERIC;
    v_total_tax NUMERIC;
    v_total_discount NUMERIC;
    v_total_transactions INT;
    v_total_items INT;
BEGIN
    -- 1. Calculate Sales, Tax, Discount
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(tax), 0),
        COALESCE(SUM(discount), 0),
        COUNT(*),
        COALESCE(SUM(jsonb_array_length(items)), 0)
    INTO 
        v_total_sales, v_total_tax, v_total_discount, v_total_transactions, v_total_items
    FROM transactions 
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date 
      AND status = 'completed';

    -- 2. Calculate COGS (FIFO-based or Average lookup)
    -- For simplicity in this report, we use the recorded COGS if available, 
    -- but usually we sum it from items or a secondary source.
    -- Here we assume HPP/COGS is tracked or needs calculation from product history.
    -- Assuming a simplified lookup for this demo:
    v_total_cogs := 0; -- In production, this would be a more complex join or subquery

    -- 3. Calculate Expenses (Grouped)
    -- Operational Expenses (Cash Out)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date::DATE >= p_start_date::DATE AND date::DATE <= p_end_date::DATE 
      AND type = 'out' 
      AND expense_group = 'operational';

    -- Write-offs (Non-Cash)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_write_offs 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date::DATE >= p_start_date::DATE AND date::DATE <= p_end_date::DATE 
      AND type = 'out' 
      AND expense_group = 'write_off';

    -- Asset Purchases (Capital Expenditure)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_assets 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date::DATE >= p_start_date::DATE AND date::DATE <= p_end_date::DATE 
      AND type = 'out' 
      AND expense_group = 'asset';

    -- 4. Calculate Other Income
    SELECT COALESCE(SUM(amount), 0) INTO v_other_income 
    FROM cash_flow 
    WHERE store_id = p_store_id 
      AND date::DATE >= p_start_date::DATE AND date::DATE <= p_end_date::DATE 
      AND type = 'in';

    RETURN jsonb_build_object(
        'total_sales', v_total_sales,
        'total_cogs', v_total_cogs,
        'total_expenses', v_total_expenses,
        'total_write_offs', v_total_write_offs,
        'other_income', v_other_income,
        'total_assets', v_total_assets,
        'total_tax', v_total_tax,
        'total_discount', v_total_discount,
        'total_transactions', v_total_transactions,
        'total_items', v_total_items,
        'net_profit', v_total_sales - v_total_cogs - v_total_expenses - v_total_write_offs + v_other_income
    );
END;
$$ LANGUAGE plpgsql STABLE;


-- RPC: get_dashboard_stats
CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day',
    p_timezone TEXT DEFAULT 'UTC'
) RETURNS JSONB AS $$
DECLARE
    v_total_sales NUMERIC;
    v_total_transactions INT;
    v_total_gross_profit NUMERIC;
    v_total_net_profit NUMERIC;
    v_chart_data JSONB;
    v_category_data JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
BEGIN
    SET TIME ZONE p_timezone;

    -- 1. Base Stats
    SELECT 
        COALESCE(SUM(total), 0),
        COUNT(*)
    INTO v_total_sales, v_total_transactions
    FROM transactions
    WHERE store_id = p_store_id 
      AND date >= p_start_date AND date <= p_end_date
      AND status = 'completed';

    -- 2. Chart Data (Grouped)
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(d) INTO v_chart_data FROM (
            SELECT to_char(date, 'HH24:00') as name, SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date AND status = 'completed'
            GROUP BY 1 ORDER BY 1
        ) d;
    ELSE
        SELECT jsonb_agg(d) INTO v_chart_data FROM (
            SELECT to_char(date, 'DD/MM') as name, SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date AND status = 'completed'
            GROUP BY 1 ORDER BY 1
        ) d;
    END IF;

    -- 3. Top Products
    SELECT jsonb_agg(d) INTO v_top_products FROM (
        SELECT 
            item->>'name' as name, 
            SUM((item->>'qty')::NUMERIC) as sold,
            SUM((item->>'total')::NUMERIC) as revenue
        FROM transactions, jsonb_array_elements(items) as item
        WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date AND status = 'completed'
        GROUP BY 1 ORDER BY 3 DESC LIMIT 5
    ) d;

    -- 4. Category Data
    SELECT jsonb_agg(d) INTO v_category_data FROM (
        SELECT 
            COALESCE(p.category, 'Lainnya') as name,
            SUM((item->>'total')::NUMERIC) as value
        FROM transactions t, 
             jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON (item->>'id')::UUID = p.id
        WHERE t.store_id = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status = 'completed'
        GROUP BY 1
    ) d;

    -- 5. Recent Transactions
    SELECT jsonb_agg(d) INTO v_recent_transactions FROM (
        SELECT id, cashier, total, date
        FROM transactions
        WHERE store_id = p_store_id
        ORDER BY date DESC LIMIT 5
    ) d;

    RETURN jsonb_build_object(
        'totalSales', v_total_sales,
        'totalTransactions', v_total_transactions,
        'avgOrder', CASE WHEN v_total_transactions > 0 THEN v_total_sales / v_total_transactions ELSE 0 END,
        'totalGrossProfit', 0, -- Calculate if buy_price available
        'totalNetProfit', 0, -- Calculate if expenses available
        'chartData', COALESCE(v_chart_data, '[]'::jsonb),
        'categoryData', COALESCE(v_category_data, '[]'::jsonb),
        'topProducts', COALESCE(v_top_products, '[]'::jsonb),
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC: get_owner_financial_summary
-- Monthly aggregation across all owned stores
CREATE OR REPLACE FUNCTION get_owner_financial_summary(
    p_year INT,
    p_timezone TEXT DEFAULT 'UTC'
) RETURNS JSONB AS $$
BEGIN
    SET TIME ZONE p_timezone;
    
    RETURN (
        SELECT jsonb_agg(d) FROM (
            WITH monthly_data AS (
                SELECT 
                    EXTRACT(MONTH FROM date) as month,
                    to_char(date, 'Mon') as month_name,
                    store_id,
                    SUM(total) as revenue,
                    0 as cogs -- Simplified
                FROM transactions
                WHERE EXTRACT(YEAR FROM date) = p_year AND status = 'completed'
                GROUP BY 1, 2, 3
            ),
            monthly_expenses AS (
                SELECT 
                    EXTRACT(MONTH FROM date) as month,
                    store_id,
                    SUM(amount) as expenses
                FROM cash_flow
                WHERE EXTRACT(YEAR FROM date) = p_year AND type = 'out' AND expense_group = 'operational'
                GROUP BY 1, 2
            )
            SELECT 
                md.month,
                md.month_name,
                SUM(md.revenue) as revenue,
                COALESCE(SUM(me.expenses), 0) as expenses,
                SUM(md.revenue) - COALESCE(SUM(me.expenses), 0) as profit,
                jsonb_agg(jsonb_build_object(
                    'store_id', md.store_id,
                    'revenue', md.revenue,
                    'expenses', COALESCE(me.expenses, 0),
                    'profit', md.revenue - COALESCE(me.expenses, 0)
                )) as stores
            FROM monthly_data md
            LEFT JOIN monthly_expenses me ON md.month = me.month AND md.store_id = me.store_id
            GROUP BY 1, 2
            ORDER BY 1
        ) d
    );
END;
$$ LANGUAGE plpgsql STABLE;
