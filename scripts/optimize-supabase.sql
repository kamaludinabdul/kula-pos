-- 1. RPC: Get Store Initial Snapshot (Hardened)
CREATE OR REPLACE FUNCTION get_store_initial_snapshot(
    p_store_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Security Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Unauthorized: User is not a member of this store';
    END IF;

    SELECT jsonb_build_object(
        'store', (SELECT to_jsonb(s) FROM stores s WHERE id = p_store_id),
        'categories', (SELECT jsonb_agg(c) FROM categories c WHERE store_id = p_store_id),
        'active_shift', (SELECT to_jsonb(sh) FROM shifts sh WHERE store_id = p_store_id AND status = 'active' LIMIT 1),
        'product_count', (SELECT count(*) FROM products WHERE store_id = p_store_id AND is_deleted = false)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: Get Profit and Loss Report (Hardened)
CREATE OR REPLACE FUNCTION get_profit_loss_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS JSONB AS $$
DECLARE
    v_sales NUMERIC;
    v_cogs NUMERIC;
    v_discount NUMERIC;
    v_tax NUMERIC;
    v_trans_count INT;
    v_net_profit NUMERIC;
    v_item_count NUMERIC;
BEGIN
    -- Security Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Aggregate Transaction Data
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(discount), 0),
        COALESCE(SUM(tax), 0),
        COUNT(*)
    INTO v_sales, v_discount, v_tax, v_trans_count
    FROM transactions
    WHERE store_id = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date 
      AND status = 'completed';

    -- Calculate COGS and Item count from JSONB items
    WITH transaction_items AS (
        SELECT 
            jsonb_array_elements(items) as item
        FROM transactions
        WHERE store_id = p_store_id 
          AND date >= p_start_date 
          AND date <= p_end_date 
          AND status = 'completed'
    )
    SELECT 
        COALESCE(SUM(
            (COALESCE(item->>'qty', '0')::NUMERIC) * 
            (COALESCE(item->>'buyPrice', item->>'buy_price', '0')::NUMERIC)
        ), 0),
        COALESCE(SUM((item->>'qty')::NUMERIC), 0)
    INTO v_cogs, v_item_count
    FROM transaction_items;

    v_net_profit := v_sales - v_cogs;

    RETURN jsonb_build_object(
        'totalSales', v_sales,
        'totalCOGS', v_cogs,
        'totalDiscount', v_discount,
        'totalTax', v_tax,
        'totalTransactions', v_trans_count,
        'totalItems', v_item_count,
        'netProfit', v_net_profit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: Get Product Sales Report (Scalable replacement for view)
-- Note: We drop first because the return signature changed
DROP FUNCTION IF EXISTS get_product_sales_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_product_sales_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    total_qty NUMERIC,
    total_revenue NUMERIC,
    total_cogs NUMERIC,
    total_profit NUMERIC,
    transaction_count BIGINT,
    category_name TEXT
) AS $$
BEGIN
    -- Security Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    WITH transaction_items AS (
        SELECT 
            t.id as trans_id,
            (jsonb_array_elements(t.items)->>'id')::UUID as item_id,
            (jsonb_array_elements(t.items)->>'qty')::NUMERIC as item_qty,
            (jsonb_array_elements(t.items)->>'price')::NUMERIC as item_price,
            (COALESCE(jsonb_array_elements(t.items)->>'buyPrice', jsonb_array_elements(t.items)->>'buy_price', '0'))::NUMERIC as item_buy_price
        FROM transactions t
        WHERE t.store_id = p_store_id 
          AND t.status = 'completed'
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
    )
    SELECT 
        p.id,
        p.name,
        COALESCE(SUM(ti.item_qty), 0),
        COALESCE(SUM(ti.item_qty * ti.item_price), 0),
        COALESCE(SUM(ti.item_qty * ti.item_buy_price), 0),
        COALESCE(SUM(ti.item_qty * (ti.item_price - ti.item_buy_price)), 0),
        COUNT(DISTINCT ti.trans_id),
        c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN transaction_items ti ON p.id = ti.item_id
    WHERE p.store_id = p_store_id AND p.is_deleted = false
    GROUP BY p.id, p.name, c.name
    HAVING SUM(ti.item_qty) > 0 OR p.stock <= p.min_stock
    ORDER BY total_qty DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Infrastructure Indexes (Scalability Patch)
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_profiles_store ON profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

-- 5. Performance Indexes (already added in Phase 2, kept for completeness)
CREATE INDEX IF NOT EXISTS idx_transactions_report ON transactions(store_id, date, status);
CREATE INDEX IF NOT EXISTS idx_products_lookup ON products(store_id, is_deleted, name);
CREATE INDEX IF NOT EXISTS idx_categories_store ON categories(store_id);

-- 6. View: Low Stock Alerts
CREATE OR REPLACE VIEW v_low_stock_alerts AS
SELECT 
    p.id,
    p.store_id,
    p.name,
    p.stock,
    p.min_stock
FROM products p
WHERE p.is_deleted = false 
  AND p.stock <= p.min_stock 
  AND p.min_stock > 0;

-- 7. RPC: Reset Loyalty Points (Batch optimized)
CREATE OR REPLACE FUNCTION reset_loyalty_points(
    p_store_id UUID
) RETURNS JSONB AS $$
BEGIN
    -- Security Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Batch Update
    UPDATE customers 
    SET loyalty_points = 0
    WHERE store_id = p_store_id AND loyalty_points > 0;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Get Sales Person Ranking
CREATE OR REPLACE FUNCTION get_sales_person_ranking(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS TABLE (
    sales_person_id UUID,
    sales_person_name TEXT,
    total_sales NUMERIC,
    total_discount NUMERIC,
    transaction_count BIGINT
) AS $$
BEGIN
    -- Security Check
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND store_id = p_store_id) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT 
        COALESCE(t.sales_person_id, t.cashier_id) as member_id,
        COALESCE(t.sales_person_name, t.cashier, 'Unknown') as member_name,
        COALESCE(SUM(t.total), 0) as total_sales,
        COALESCE(SUM(t.discount), 0) as total_discount,
        COUNT(*) as transaction_count
    FROM transactions t
    WHERE t.store_id = p_store_id 
      AND t.status = 'completed'
      AND t.date >= p_start_date 
      AND t.date <= p_end_date
    GROUP BY member_id, member_name
    ORDER BY total_sales DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Supplemental Infrastructure Indexes (Operational Coverage)
CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_history ON point_adjustments(store_id, date);
CREATE INDEX IF NOT EXISTS idx_suppliers_store ON suppliers(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_lookup ON purchase_orders(store_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_active ON shifts(store_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_movements_shift ON shift_movements(shift_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_lookup ON audit_logs(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cash_flow_store_date ON cash_flow(store_id, date);
