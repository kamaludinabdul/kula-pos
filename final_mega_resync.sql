-- SCHEMA CORRECTIONS
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.loyalty_history ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
NOTIFY pgrst, 'reload schema';


-- FROM sql/functions/add_session_item.sql
-- MASTER: add_session_item
-- Purpose: Add a product/service item to a rental/service session and deduct stock
-- Source: scripts/deploy_prod.sql

CREATE OR REPLACE FUNCTION public.add_session_item(
    p_session_id UUID,
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_price NUMERIC
) RETURNS JSONB 
AS $$
DECLARE
    v_product_name TEXT;
    v_new_item JSONB;
BEGIN
    SELECT name INTO v_product_name FROM products WHERE id = p_product_id AND store_id = p_store_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    UPDATE products 
    SET stock = stock - p_qty 
    WHERE id = p_product_id AND store_id = p_store_id;

    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
    VALUES (p_store_id, p_product_id, 'out', p_qty, NOW(), 'Used in Service Session', p_session_id::TEXT);

    v_new_item := jsonb_build_object(
        'id', p_product_id,
        'name', v_product_name,
        'qty', p_qty,
        'price', p_price,
        'stock_deducted', true,
        'added_at', NOW()
    );

    UPDATE rental_sessions
    SET orders = CASE 
        WHEN orders IS NULL THEN jsonb_build_array(v_new_item)
        ELSE orders || v_new_item
    END
    WHERE id = p_session_id AND store_id = p_store_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/add_stock_batch.sql
-- MASTER: add_stock_batch
-- Purpose: Add stock with batch tracking, buy price update, and expiry date support

CREATE OR REPLACE FUNCTION public.add_stock_batch(
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_buy_price NUMERIC,
    p_sell_price NUMERIC,
    p_note TEXT DEFAULT '',
    p_expired_date DATE DEFAULT NULL
) RETURNS JSONB 
AS $$
DECLARE v_batch_id UUID;
BEGIN
    UPDATE products SET stock = stock + p_qty, buy_price = p_buy_price, sell_price = CASE WHEN p_sell_price > 0 THEN p_sell_price ELSE sell_price END, updated_at = NOW() WHERE id = p_product_id AND store_id = p_store_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Product not found'); END IF;
    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note) VALUES (p_store_id, p_product_id, 'in', p_qty, NOW(), COALESCE(p_note, 'Manual Addition'));
    INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date) VALUES (p_store_id, p_product_id, p_qty, p_qty, p_buy_price, NOW(), COALESCE(p_note, 'Manual Addition'), p_expired_date) RETURNING id INTO v_batch_id;
    RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/adjust_stock.sql
-- MASTER: adjust_stock
-- Purpose: Manual stock level adjustment with audit logging

CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_store_id UUID,
    p_product_id UUID,
    p_qty_change NUMERIC,
    p_type TEXT,
    p_note TEXT DEFAULT 'Manual Adjustment'
) RETURNS JSONB 
AS $$
BEGIN
    UPDATE products SET stock = stock + p_qty_change, updated_at = NOW() WHERE id = p_product_id AND store_id = p_store_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Product not found'); END IF;
    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note) VALUES (p_store_id, p_product_id, p_type, p_qty_change, NOW(), p_note);
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/approve_subscription_invoice.sql
-- MASTER: approve_subscription_invoice
-- Purpose: Admin tool to approve a subscription invoice and update store plan/expiry
-- Source: scripts/setup_approval_rpc.sql

CREATE OR REPLACE FUNCTION public.approve_subscription_invoice(
    p_invoice_id UUID,
    p_admin_id UUID
) RETURNS JSONB 
AS $$
DECLARE
    v_invoice RECORD;
    v_store RECORD;
    v_new_expiry TIMESTAMPTZ;
    v_duration_interval INTERVAL;
BEGIN
    -- 1. Fetch Invoice
    SELECT * INTO v_invoice FROM subscription_invoices WHERE id = p_invoice_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF v_invoice.status = 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice already approved');
    END IF;

    -- 2. Fetch Store
    SELECT * INTO v_store FROM stores WHERE id = v_invoice.store_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Store not found');
    END IF;

    -- 3. Calculate New Expiry
    v_duration_interval := (v_invoice.duration_months || ' months')::INTERVAL;
    
    IF v_store.plan = v_invoice.plan_id AND v_store.plan_expiry_date > NOW() THEN
        v_new_expiry := v_store.plan_expiry_date + v_duration_interval;
    ELSE
        v_new_expiry := NOW() + v_duration_interval;
    END IF;

    -- 4. Update Store
    UPDATE stores 
    SET plan = v_invoice.plan_id,
        plan_expiry_date = v_new_expiry
    WHERE id = v_invoice.store_id;

    -- 5. Update Invoice
    UPDATE subscription_invoices
    SET status = 'approved',
        approved_at = NOW(),
        approved_by = p_admin_id
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/bulk_add_products.sql
-- MASTER: bulk_add_products
-- Purpose: Optimized bulk product import with initial batch creation

CREATE OR REPLACE FUNCTION public.bulk_add_products(
    p_store_id UUID,
    p_products JSONB
) RETURNS JSONB 
AS $$
DECLARE
    v_product RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_product IN SELECT * FROM jsonb_to_recordset(p_products) AS x(
        name TEXT, 
        sku TEXT, 
        barcode TEXT, 
        category_id UUID, 
        buy_price NUMERIC, 
        sell_price NUMERIC, 
        stock NUMERIC, 
        unit TEXT, 
        description TEXT,
        is_unlimited BOOLEAN,
        min_stock NUMERIC,
        expired_date DATE
    )
    LOOP
        INSERT INTO public.products (
            store_id, name, sku, barcode, category_id, buy_price, sell_price, 
            stock, unit, description, is_unlimited, min_stock
        )
        VALUES (
            p_store_id, v_product.name, v_product.sku, v_product.barcode, v_product.category_id, 
            v_product.buy_price, v_product.sell_price, v_product.stock, v_product.unit, 
            v_product.description, COALESCE(v_product.is_unlimited, false), COALESCE(v_product.min_stock, 0)
        )
        ON CONFLICT (store_id, sku) DO NOTHING;

        -- Create initial batch if stock > 0
        IF v_product.stock > 0 THEN
            INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date)
            SELECT p_store_id, id, v_product.stock, v_product.stock, v_product.buy_price, NOW(), 'Initial Stock (Bulk Add)', v_product.expired_date
            FROM public.products 
            WHERE sku = v_product.sku AND store_id = p_store_id;
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/bulk_update_stock.sql
-- MASTER: bulk_update_stock
-- Purpose: Optimized bulk stock update with FIFO-compatible batch creation

CREATE OR REPLACE FUNCTION public.bulk_update_stock(
    p_store_id UUID,
    p_updates JSONB
) RETURNS JSONB 
AS $$
DECLARE
    v_update RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_update IN SELECT * FROM jsonb_to_recordset(p_updates) AS x(
        id UUID, 
        stock NUMERIC, 
        buy_price NUMERIC, 
        sell_price NUMERIC,
        expired_date DATE
    )
    LOOP
        -- Update global product stock
        UPDATE public.products
        SET stock = v_update.stock,
            buy_price = CASE WHEN v_update.buy_price > 0 THEN v_update.buy_price ELSE buy_price END,
            sell_price = CASE WHEN v_update.sell_price > 0 THEN v_update.sell_price ELSE sell_price END,
            updated_at = NOW()
        WHERE id = v_update.id AND store_id = p_store_id;

        -- Create a new batch for the updated stock
        IF v_update.stock > 0 THEN
            INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date)
            VALUES (p_store_id, v_update.id, v_update.stock, v_update.stock, v_update.buy_price, NOW(), 'Bulk Stock Update', v_update.expired_date);
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/check_staff_conflict.sql
-- MASTER: check_staff_conflict
-- Purpose: Check if an email is already registered to another store
-- Source: scripts/create_check_conflict_rpc.sql

CREATE OR REPLACE FUNCTION public.check_staff_conflict(
    p_email TEXT,
    p_target_store_id UUID
) RETURNS JSONB 
AS $$
DECLARE
    v_profile RECORD;
    v_store_name TEXT;
BEGIN
    -- 1. Check if profile exists
    SELECT * INTO v_profile FROM profiles WHERE email = p_email LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'available');
    END IF;

    -- 2. Check Store ID
    IF v_profile.store_id = p_target_store_id THEN
        RETURN jsonb_build_object(
            'status', 'same_store',
            'current_role', v_profile.role,
            'id', v_profile.id
        );
    ELSE
        -- Fetch store name for friendly error message
        SELECT name INTO v_store_name FROM stores WHERE id = v_profile.store_id;
        
        RETURN jsonb_build_object(
            'status', 'conflict', 
            'current_store_name', COALESCE(v_store_name, 'Unknown Store')
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/copy_products_to_store.sql
-- MASTER: copy_products_to_store
-- Purpose: Duplicate products from one store to another, handling categories and avoiding duplicate barcodes
-- Source: scripts/simplified_copy_products.sql

CREATE OR REPLACE FUNCTION public.copy_products_to_store(
    p_source_store_id UUID,
    p_target_store_id UUID,
    p_product_ids UUID[]
) RETURNS JSONB 
AS $$
DECLARE
    v_product RECORD;
    v_target_category_id UUID;
    v_copied_count INT := 0;
    v_skipped_count INT := 0;
BEGIN
    FOR v_product IN 
        SELECT p.id, p.name, p.barcode, p.buy_price, p.sell_price, p.unit, 
               p.min_stock, p.type, p.image_url, p.description, p.category_id,
               c.name as category_name 
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ANY(p_product_ids) 
          AND p.store_id = p_source_store_id
          AND p.is_deleted = false
    LOOP
        -- Skip if barcode exists in target
        IF v_product.barcode IS NOT NULL AND EXISTS (
            SELECT 1 FROM products 
            WHERE store_id = p_target_store_id 
            AND barcode = v_product.barcode 
            AND is_deleted = false
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Category Mapping
        v_target_category_id := NULL;
        IF v_product.category_name IS NOT NULL THEN
            SELECT id INTO v_target_category_id 
            FROM categories 
            WHERE store_id = p_target_store_id 
              AND LOWER(name) = LOWER(v_product.category_name);
            
            IF v_target_category_id IS NULL THEN
                INSERT INTO categories (store_id, name) 
                VALUES (p_target_store_id, v_product.category_name) 
                RETURNING id INTO v_target_category_id;
            END IF;
        END IF;

        -- Insert Product
        INSERT INTO products (
            store_id, category_id, name, barcode, buy_price, sell_price, stock, unit, min_stock, type, image_url, description
        ) VALUES (
            p_target_store_id, v_target_category_id, v_product.name, v_product.barcode,
            COALESCE(v_product.buy_price, 0), COALESCE(v_product.sell_price, 0),
            0, -- Reset stock to 0 for target store
            v_product.unit, COALESCE(v_product.min_stock, 0),
            COALESCE(v_product.type, 'product'), v_product.image_url, v_product.description
        );

        v_copied_count := v_copied_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'copiedCount', v_copied_count, 'skippedCount', v_skipped_count);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/create_initial_batch.sql
-- MASTER: create_initial_batch
-- Purpose: Assign an expiry date to existing stock without batch records
-- Source: scripts/create-initial-batch-rpc.sql

CREATE OR REPLACE FUNCTION public.create_initial_batch(
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_buy_price NUMERIC,
    p_expired_date DATE
) RETURNS JSONB 
AS $$
DECLARE
    v_batch_id UUID;
BEGIN
    -- Check if product exists and store_id matches
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND store_id = p_store_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    -- Create batch for existing stock
    INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date)
    VALUES (p_store_id, p_product_id, p_qty, p_qty, COALESCE(p_buy_price, 0), NOW(), 'Migrasi Stok Awal (Expired Tracking)', p_expired_date)
    RETURNING id INTO v_batch_id;

    RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_dashboard_monthly_summary.sql
-- MASTER: get_dashboard_monthly_summary
-- Purpose: Monthly summary chart for Store Dashboard
-- Source: scripts/deploy_prod.sql

DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_dashboard_monthly_summary(
    p_store_id UUID, 
    p_year INTEGER
) RETURNS JSONB
AS $$
DECLARE v_result JSONB;
BEGIN
    WITH transaction_items AS (
        SELECT 
            EXTRACT(MONTH FROM (t.date AT TIME ZONE 'Asia/Jakarta'))::INTEGER as month_num,
            t.id as trans_id,
            t.total,
            t.date,
            (SELECT COALESCE(SUM((item->>'qty')::NUMERIC * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)), 0)
             FROM jsonb_array_elements(t.items) as item) as item_cogs
        FROM transactions t
        WHERE t.store_id = p_store_id 
          AND EXTRACT(YEAR FROM (t.date AT TIME ZONE 'Asia/Jakarta')) = p_year 
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
    ),
    monthly_data AS (
        SELECT 
            month_num,
            COUNT(trans_id) as transaction_count,
            SUM(total) as total_revenue,
            SUM(total - item_cogs) as total_gross_profit,
            COUNT(DISTINCT DATE(date AT TIME ZONE 'Asia/Jakarta')) as days_with_sales
        FROM transaction_items
        GROUP BY month_num
    ),
    monthly_expenses AS (
        SELECT 
            EXTRACT(MONTH FROM (cf.date AT TIME ZONE 'Asia/Jakarta'))::INTEGER as month_num, 
            COALESCE(SUM(cf.amount), 0) as total_opex
        FROM cash_flow cf
        WHERE cf.store_id = p_store_id 
          AND EXTRACT(YEAR FROM (cf.date AT TIME ZONE 'Asia/Jakarta')) = p_year 
          AND cf.type = 'out' 
          AND COALESCE(cf.expense_group, 'operational') != 'asset'
        GROUP BY EXTRACT(MONTH FROM (cf.date AT TIME ZONE 'Asia/Jakarta'))
    ),
    all_months AS (SELECT generate_series(1, 12) as month_num)
    SELECT jsonb_agg(
        jsonb_build_object(
            'monthIndex', am.month_num - 1,
            'name', TO_CHAR(DATE '2020-01-01' + ((am.month_num - 1) || ' month')::interval, 'Mon'),
            'totalRevenue', COALESCE(md.total_revenue, 0),
            'totalProfit', COALESCE(md.total_gross_profit, 0) - COALESCE(me.total_opex, 0),
            'totalOpEx', COALESCE(me.total_opex, 0),
            'transactionsCount', COALESCE(md.transaction_count, 0),
            'daysWithSales', COALESCE(md.days_with_sales, 0),
            'avgDailyRevenue', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN COALESCE(md.total_revenue, 0) / md.days_with_sales ELSE 0 END,
            'avgDailyGrossProfit', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN COALESCE(md.total_gross_profit, 0) / md.days_with_sales ELSE 0 END,
            'avgDailyProfit', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN (COALESCE(md.total_gross_profit, 0) - COALESCE(me.total_opex, 0)) / md.days_with_sales ELSE 0 END
        ) ORDER BY am.month_num
    ) INTO v_result
    FROM all_months am 
    LEFT JOIN monthly_data md ON md.month_num = am.month_num 
    LEFT JOIN monthly_expenses me ON me.month_num = am.month_num;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_dashboard_stats.sql
-- MASTER: get_dashboard_stats
-- Purpose: Comprehensive dashboard data (Sales, Chart, Categories, Top products, Recent trans)
-- Supports TEXT store_id for NanoID/UUID compatibility.
-- Source: scripts/fix-dashboard-stats-final.sql

DROP FUNCTION IF EXISTS public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day',
    p_timezone TEXT DEFAULT 'Asia/Jakarta'
) RETURNS JSONB 
AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_transactions INT := 0;
    v_avg_order NUMERIC := 0;
    v_total_cogs NUMERIC := 0;
    v_total_gross_profit NUMERIC := 0;
    v_total_opex NUMERIC := 0;
    v_total_net_profit NUMERIC := 0;
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
      AND (LOWER(status) IN ('completed', 'success', 'paid', 'berhasil') OR status IS NULL);

    -- Calculate COGS
    WITH items_expanded AS (
        SELECT (item->>'qty')::numeric as q, 
               COALESCE((item->>'buyPrice')::numeric, (item->>'buy_price')::numeric, 0) as b
        FROM transactions t, jsonb_array_elements(items) as item
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
    )
    SELECT COALESCE(SUM(q * b), 0) INTO v_total_cogs FROM items_expanded;

    v_total_gross_profit := v_total_sales - v_total_cogs;

    -- Calculate OpEx
    SELECT COALESCE(SUM(amount), 0) INTO v_total_opex
    FROM cash_flow
    WHERE store_id = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date
      AND type = 'out'
      AND COALESCE(expense_group, 'operational') != 'asset';

    v_total_net_profit := v_total_gross_profit - v_total_opex;

    -- 2. Chart Data
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date_trunc('hour', date AT TIME ZONE p_timezone), 'HH24:00') as name,
                EXTRACT(HOUR FROM date AT TIME ZONE p_timezone) as hour,
                SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id 
              AND date >= p_start_date 
              AND date <= p_end_date
              AND (LOWER(status) IN ('completed', 'success', 'paid', 'berhasil') OR status IS NULL)
            GROUP BY 1, 2
            ORDER BY 2
        ) stats;
    ELSE
        SELECT jsonb_agg(stats) INTO v_chart_data
        FROM (
            SELECT 
                to_char(date AT TIME ZONE p_timezone, 'DD Mon') as name,
                date_trunc('day', date AT TIME ZONE p_timezone) as date_val,
                SUM(total) as total
            FROM transactions
            WHERE store_id = p_store_id 
              AND date >= p_start_date 
              AND date <= p_end_date
              AND (LOWER(status) IN ('completed', 'success', 'paid', 'berhasil') OR status IS NULL)
            GROUP BY 1, 2
            ORDER BY 2
        ) stats;
    END IF;

    -- 3. Category Stats
    SELECT jsonb_agg(dataset) INTO v_category_stats
    FROM (
        SELECT 
            COALESCE(c.name, 'Uncategorized') as name,
            SUM((item->>'qty')::numeric * COALESCE((item->>'price')::numeric, (item->>'sellPrice')::numeric, (item->>'sell_price')::numeric, 0)) as value
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON p.id::text = (item->>'id')
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
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
            SUM((item->>'qty')::numeric * COALESCE((item->>'price')::numeric, (item->>'sellPrice')::numeric, (item->>'sell_price')::numeric, 0)) as revenue
        FROM transactions t,
             jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
        GROUP BY 1
        ORDER BY 3 DESC
        LIMIT 10
    ) top;

    -- 5. Recent Transactions
    SELECT jsonb_agg(recent) INTO v_recent_transactions
    FROM (
        SELECT t.id, COALESCE(prof.name, t.cashier) as cashier, t.date, t.total, t.status
        FROM transactions t
        LEFT JOIN profiles prof ON prof.id = t.cashier_id
        WHERE t.store_id = p_store_id 
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
        ORDER BY t.date DESC
        LIMIT 5
    ) recent;

    RETURN jsonb_build_object(
        'totalSales', v_total_sales,
        'totalTransactions', v_total_transactions,
        'avgOrder', v_avg_order,
        'totalGrossProfit', v_total_gross_profit,
        'totalNetProfit', v_total_net_profit,
        'totalProfit', v_total_net_profit,
        'chartData', COALESCE(v_chart_data, '[]'::jsonb),
        'categoryData', COALESCE(v_category_stats, '[]'::jsonb),
        'topProducts', COALESCE(v_top_products, '[]'::jsonb),
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_my_store_id.sql
-- MASTER: get_my_store_id
-- Purpose: Helper function to get the current user's store_id from their profile
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.get_my_store_id()
RETURNS UUID 
AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_owner_daily_sales.sql
-- MASTER: get_owner_daily_sales
-- Purpose: Hourly/Daily sales chart for multi-store comparison (Owner View)
-- Source: scripts/update_owner_rpcs_multistore.sql

CREATE OR REPLACE FUNCTION public.get_owner_daily_sales(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day'
)
RETURNS JSONB
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_owner_dashboard_stats.sql
-- MASTER: get_owner_dashboard_stats
-- Purpose: Owner View Summary (Multi-store)
-- Source: fix_dashboard_production.sql

CREATE OR REPLACE FUNCTION public.get_owner_dashboard_stats(p_start_date TIMESTAMPTZ, p_end_date TIMESTAMPTZ)
RETURNS JSON   
AS $$
DECLARE
    v_result JSON;
    v_user_id UUID;
    v_total_opex NUMERIC := 0;
    v_total_sales NUMERIC := 0;
    v_total_cogs NUMERIC := 0;
    v_total_transactions INT := 0;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;

    -- Get total metrics
    SELECT 
        COALESCE(SUM(t.total), 0),
        COALESCE(COUNT(t.id), 0),
        COALESCE(SUM((
            SELECT SUM(COALESCE((item->>'qty')::numeric, 0) * COALESCE((item->>'buyPrice')::numeric, (item->>'buy_price')::numeric, 0))
            FROM jsonb_array_elements(t.items) as item
        )), 0)
    INTO v_total_sales, v_total_transactions, v_total_cogs
    FROM stores s
    LEFT JOIN transactions t ON t.store_id = s.id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status IN ('completed', 'success', 'paid', 'paid_off')
    WHERE s.owner_id = v_user_id;

    -- Get total opex
    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_opex
    FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow
        UNION ALL
        SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf
    JOIN stores s ON s.id = cf.store_id
    WHERE s.owner_id = v_user_id 
      AND cf.date >= p_start_date AND cf.date <= p_end_date 
      AND cf.type IN ('out', 'expense') 
      AND COALESCE(cf.expense_group, 'operational') = 'operational';
    
    SELECT json_build_object(
        'totalSales', v_total_sales,
        'totalTransactions', v_total_transactions,
        'avgOrder', CASE WHEN v_total_transactions > 0 THEN v_total_sales / v_total_transactions ELSE 0 END,
        'totalGrossProfit', v_total_sales - v_total_cogs,
        'totalNetProfit', v_total_sales - v_total_cogs - v_total_opex,
        'storeBreakdown', (SELECT COALESCE(json_agg(store_data), '[]'::json) FROM (SELECT s.id as store_id, s.name as store_name, s.plan, COALESCE(SUM(CASE WHEN tx.status IN ('completed', 'success', 'paid', 'paid_off') THEN tx.total ELSE 0 END), 0) as total_sales, COALESCE(COUNT(CASE WHEN tx.status IN ('completed', 'success', 'paid', 'paid_off') THEN 1 END), 0) as total_transactions FROM stores s LEFT JOIN transactions tx ON tx.store_id = s.id AND tx.date >= p_start_date AND tx.date <= p_end_date WHERE s.owner_id = v_user_id GROUP BY s.id, s.name, s.plan ORDER BY total_sales DESC) store_data),
        'totalStores', (SELECT COUNT(*) FROM stores WHERE owner_id = v_user_id)
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_owner_financial_summary.sql
-- MASTER: get_owner_financial_summary
-- Purpose: Monthly financial summary with multi-store breakdown (Owner View)
-- Source: scripts/update_owner_rpcs_multistore.sql

CREATE OR REPLACE FUNCTION public.get_owner_financial_summary(p_year INT)
RETURNS JSONB
AS $$
DECLARE
    v_owner_id UUID;
    v_result JSONB;
BEGIN
    v_owner_id := auth.uid();
    IF v_owner_id IS NULL THEN RETURN jsonb_build_array(); END IF;
    
    WITH months AS (
        SELECT (make_date(p_year, m, 1))::DATE as month_date
        FROM generate_series(1, 12) m
    ),
    -- Sales & COGS per store/month
    store_monthly_sales AS (
        SELECT 
            date_trunc('month', t.date)::DATE as m_date,
            t.store_id,
            s.name as store_name,
            SUM(t.total) as sales,
            COUNT(*) as transactions,
            COUNT(DISTINCT t.date::date) as active_days,
            SUM((
                SELECT SUM(COALESCE((item->>'qty')::NUMERIC, 0) * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0))
                FROM jsonb_array_elements(t.items) as item
            )) as cogs
        FROM transactions t
        JOIN stores s ON t.store_id = s.id
        WHERE s.owner_id = v_owner_id
          AND t.status IN ('completed', 'paid')
          AND EXTRACT(YEAR FROM t.date) = p_year
        GROUP BY 1, 2, 3
    ),
    -- Expenses per store/month
    store_monthly_expenses AS (
        SELECT 
            date_trunc('month', cf.date)::DATE as m_date,
            cf.store_id,
            s.name as store_name,
            SUM(CASE WHEN cf.type = 'expense' AND (cf.expense_group != 'asset' OR cf.expense_group IS NULL) THEN cf.amount ELSE 0 END) as expenses,
            SUM(CASE WHEN cf.type = 'income' THEN cf.amount ELSE 0 END) as other_income
        FROM cash_flow cf
        JOIN stores s ON cf.store_id = s.id
        WHERE s.owner_id = v_owner_id
          AND EXTRACT(YEAR FROM cf.date) = p_year
        GROUP BY 1, 2, 3
    ),
    -- Combined distinct list of stores involved in this month (sales OR expenses)
    active_stores_per_month AS (
        SELECT DISTINCT m_date, store_id, store_name FROM store_monthly_sales
        UNION 
        SELECT DISTINCT m_date, store_id, store_name FROM store_monthly_expenses
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'month', EXTRACT(MONTH FROM m.month_date),
            'month_name', to_char(m.month_date, 'Mon'),
            'days_in_month', EXTRACT(DAY FROM (m.month_date + interval '1 month' - interval '1 day')),
            -- Aggregated Totals
            'revenue', (SELECT COALESCE(SUM(sales), 0) FROM store_monthly_sales WHERE m_date = m.month_date),
            'expenses', (SELECT COALESCE(SUM(expenses), 0) FROM store_monthly_expenses WHERE m_date = m.month_date),
            'active_days', (
                -- Total distinct dates across ALL stores for this month
                SELECT COUNT(DISTINCT t.date::date)
                FROM transactions t
                JOIN stores s ON t.store_id = s.id
                WHERE s.owner_id = v_owner_id
                  AND t.status IN ('completed', 'paid')
                  AND date_trunc('month', t.date)::DATE = m.month_date
            ),
            'profit', (
                SELECT COALESCE(SUM(sales), 0) - COALESCE(SUM(cogs), 0) 
                FROM store_monthly_sales WHERE m_date = m.month_date
            ) - (
                SELECT COALESCE(SUM(expenses), 0) - COALESCE(SUM(other_income), 0)
                FROM store_monthly_expenses WHERE m_date = m.month_date
            ),
            -- Per Store Breakdown
            'stores', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'store_id', asm.store_id,
                        'store_name', asm.store_name,
                        'revenue', COALESCE(sms.sales, 0),
                        'expenses', COALESCE(sme.expenses, 0),
                        'cogs', COALESCE(sms.cogs, 0),
                        'active_days', COALESCE(sms.active_days, 0),
                        'profit', COALESCE(sms.sales, 0) - COALESCE(sms.cogs, 0) - COALESCE(sme.expenses, 0) + COALESCE(sme.other_income, 0),
                        'other_income', COALESCE(sme.other_income, 0),
                        'transactions', COALESCE(sms.transactions, 0)
                    )
                )
                FROM active_stores_per_month asm
                LEFT JOIN store_monthly_sales sms ON asm.store_id = sms.store_id AND asm.m_date = sms.m_date
                LEFT JOIN store_monthly_expenses sme ON asm.store_id = sme.store_id AND asm.m_date = sme.m_date
                WHERE asm.m_date = m.month_date
            )
        )
        ORDER BY m.month_date
    ) INTO v_result
    FROM months m;

    RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_owner_low_stock_alerts.sql
-- MASTER: get_owner_low_stock_alerts
-- Purpose: Retrieves low stock products from all stores owned by a specific owner
-- Source: scripts/create-owner-low-stock-rpc.sql

CREATE OR REPLACE FUNCTION public.get_owner_low_stock_alerts(p_owner_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    current_stock NUMERIC,
    minimum_stock NUMERIC,
    store_id UUID,
    store_name TEXT
)
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_product_sales_report.sql
-- MASTER: get_product_sales_report
-- Purpose: Detailed product-wise sales performance and profit margins

CREATE OR REPLACE FUNCTION public.get_product_sales_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS TABLE (product_id TEXT, product_name TEXT, category_name TEXT, total_qty NUMERIC, total_revenue NUMERIC, total_cogs NUMERIC, total_profit NUMERIC, transaction_count BIGINT) 
AS $$
BEGIN
    RETURN QUERY
    WITH sale_items AS (
        SELECT t.id as trans_id, (item->>'id') as p_id, (item->>'name') as p_name, COALESCE((item->>'qty')::NUMERIC, 0) as q, COALESCE((item->>'price')::NUMERIC, 0) as p, COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c
        FROM transactions t, jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status = 'completed'
    )
    SELECT s.p_id as product_id, s.p_name as product_name, COALESCE(cat.name, 'Tanpa Kategori') as category_name, SUM(s.q) as t_qty, SUM(s.q * s.p) as t_revenue, SUM(s.q * s.c) as t_cogs, SUM(s.q * (s.p - s.c)) as t_profit, COUNT(DISTINCT s.trans_id) as transaction_count
    FROM sale_items s LEFT JOIN products pr ON s.p_id = pr.id::TEXT LEFT JOIN categories cat ON pr.category_id = cat.id
    GROUP BY s.p_id, s.p_name, cat.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_products_page.sql
-- MASTER: get_products_page
-- Purpose: Paginated product list with search, category filter, and sorting
-- Source: scripts/deploy_prod.sql

CREATE OR REPLACE FUNCTION public.get_products_page(
    p_store_id UUID,
    p_page INT,
    p_page_size INT,
    p_search TEXT DEFAULT '',
    p_category TEXT DEFAULT 'all',
    p_satuan_po TEXT DEFAULT 'all',
    p_sort_key TEXT DEFAULT 'name',
    p_sort_dir TEXT DEFAULT 'asc'
) RETURNS JSONB
  -- CRITICAL: Bypass RLS, filter by p_store_id internally
AS $$
DECLARE
    v_offset INT;
    v_total BIGINT;
    v_products JSONB;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    -- 1. Calculate Total Count
    SELECT COUNT(*)
    INTO v_total
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = p_store_id
    AND p.is_deleted = false
    AND (
        p_search = '' OR
        p.name ILIKE '%' || p_search || '%' OR
        p.barcode ILIKE '%' || p_search || '%'
    )
    AND (
        p_category = 'all' OR
        c.name = p_category OR
        p.category_id::text = p_category
    )
    AND (
        p_satuan_po = 'all' OR
        (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR
        (p_satuan_po = 'no' AND p.purchase_unit IS NULL)
    );

    -- 2. Fetch Page Data as JSONB
    SELECT jsonb_agg(row_to_json(pd)::jsonb)
    INTO v_products
    FROM (
        SELECT 
            p.id, p.name, p.barcode,
            p.buy_price AS "buyPrice",
            p.sell_price AS "sellPrice",
            p.stock,
            c.name AS category,
            p.category_id AS "categoryId",
            p.unit,
            p.min_stock AS "minStock",
            p.discount,
            p.discount_type AS "discountType",
            p.is_unlimited AS "isUnlimited",
            p.purchase_unit AS "purchaseUnit",
            p.conversion_to_unit AS "conversionToUnit",
            p.rack_location AS "rackLocation",
            p.image_url AS "imageUrl",
            p.pricing_type AS "pricingType",
            p.pricing_tiers AS "pricingTiers",
            p.is_bundling_enabled AS "isBundlingEnabled",
            p.created_at AS "createdAt",
            (p.sell_price - p.buy_price) AS profit
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.store_id = p_store_id
        AND p.is_deleted = false
        AND (
            p_search = '' OR
            p.name ILIKE '%' || p_search || '%' OR
            p.barcode ILIKE '%' || p_search || '%'
        )
        AND (
            p_category = 'all' OR
            c.name = p_category OR
            p.category_id::text = p_category
        )
        AND (
            p_satuan_po = 'all' OR
            (p_satuan_po = 'yes' AND p.purchase_unit IS NOT NULL) OR
            (p_satuan_po = 'no' AND p.purchase_unit IS NULL)
        )
        ORDER BY
            CASE WHEN p_sort_dir = 'asc' THEN
                CASE WHEN p_sort_key = 'name' THEN p.name WHEN p_sort_key = 'category' THEN c.name ELSE NULL END
            END ASC,
            CASE WHEN p_sort_dir = 'desc' THEN
                CASE WHEN p_sort_key = 'name' THEN p.name WHEN p_sort_key = 'category' THEN c.name ELSE NULL END
            END DESC,
            CASE WHEN p_sort_dir = 'asc' THEN
                CASE WHEN p_sort_key = 'stock' THEN p.stock WHEN p_sort_key = 'sellPrice' THEN p.sell_price WHEN p_sort_key = 'buyPrice' THEN p.buy_price WHEN p_sort_key = 'profit' THEN (p.sell_price - p.buy_price) ELSE NULL END
            END ASC,
            CASE WHEN p_sort_dir = 'desc' THEN
                CASE WHEN p_sort_key = 'stock' THEN p.stock WHEN p_sort_key = 'sellPrice' THEN p.sell_price WHEN p_sort_key = 'buyPrice' THEN p.buy_price WHEN p_sort_key = 'profit' THEN (p.sell_price - p.buy_price) ELSE NULL END
            END DESC,
            p.created_at DESC
        LIMIT p_page_size
        OFFSET v_offset
    ) pd;

    -- 3. Return JSONB payload
    RETURN jsonb_build_object(
        'data', COALESCE(v_products, '[]'::jsonb),
        'total', v_total,
        'page', p_page,
        'pageSize', p_page_size
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_profit_loss_report.sql
-- MASTER: get_profit_loss_report
-- Purpose: Advanced Profit & Loss calculation including OPEX and Other Income

DROP FUNCTION IF EXISTS public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.get_profit_loss_report(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS JSONB 
AS $$
DECLARE
    v_total_sales NUMERIC := 0; v_total_cogs NUMERIC := 0; v_total_discount NUMERIC := 0; v_total_tax NUMERIC := 0;
    v_total_transactions INTEGER := 0; v_total_items NUMERIC := 0; v_total_expenses NUMERIC := 0;
    v_other_income NUMERIC := 0; v_total_assets NUMERIC := 0; v_net_profit NUMERIC := 0;
    v_total_cash NUMERIC := 0; v_total_qris NUMERIC := 0; v_total_transfer NUMERIC := 0;
BEGIN
    SELECT 
        COALESCE(SUM(total), 0), 
        COALESCE(SUM(discount), 0), 
        COALESCE(SUM(tax), 0), 
        COUNT(*),
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'cash' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'qris' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN LOWER(payment_method) = 'transfer' THEN total ELSE 0 END), 0)
    INTO 
        v_total_sales, v_total_discount, v_total_tax, v_total_transactions,
        v_total_cash, v_total_qris, v_total_transfer
    FROM transactions 
    WHERE store_id = p_store_id 
      AND date >= p_start_date 
      AND date <= p_end_date 
      AND (LOWER(status) IN ('completed', 'success', 'paid', 'berhasil') OR status IS NULL);

    WITH expanded_items AS (
        SELECT COALESCE((item->>'qty')::NUMERIC, 0) as q, COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c
        FROM transactions t, jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id 
          AND t.date >= p_start_date 
          AND t.date <= p_end_date 
          AND (LOWER(t.status) IN ('completed', 'success', 'paid', 'berhasil') OR t.status IS NULL)
    )
    SELECT COALESCE(SUM(q), 0), COALESCE(SUM(q * c), 0) INTO v_total_items, v_total_cogs FROM expanded_items;

    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_expenses FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow UNION ALL SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf WHERE cf.store_id = p_store_id 
          AND cf.date >= p_start_date 
          AND cf.date <= p_end_date 
          AND cf.type IN ('out', 'expense') 
          AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational', 'write_off');

    SELECT COALESCE(SUM(amount), 0) INTO v_other_income FROM cash_flow WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date AND type = 'income';
    SELECT COALESCE(SUM(amount), 0) INTO v_total_assets FROM cash_flow WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date AND expense_group = 'asset';

    v_net_profit := v_total_sales - v_total_cogs - v_total_expenses + v_other_income;

    RETURN jsonb_build_object(
        'total_sales', v_total_sales, 
        'total_cogs', v_total_cogs, 
        'total_expenses', v_total_expenses, 
        'other_income', v_other_income, 
        'net_profit', v_net_profit, 
        'total_transactions', v_total_transactions, 
        'total_items', v_total_items, 
        'total_tax', v_total_tax, 
        'total_discount', v_total_discount, 
        'total_assets', v_total_assets,
        'total_cash', v_total_cash,
        'total_qris', v_total_qris,
        'total_transfer', v_total_transfer
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_sales_person_ranking.sql
-- MASTER: get_sales_person_ranking
-- Purpose: Ranks sales people by total sales within a store for a given period
-- Reconstructed based on SalesPerformanceReport.jsx requirements

CREATE OR REPLACE FUNCTION public.get_sales_person_ranking(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    sales_person_id UUID,
    sales_person_name TEXT,
    total_sales NUMERIC,
    total_discount NUMERIC,
    transaction_count BIGINT
) 
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.cashier_id as sales_person_id,
        COALESCE(t.cashier, 'Unknown') as sales_person_name,
        SUM(t.total) as total_sales,
        SUM(t.discount) as total_discount,
        COUNT(t.id) as transaction_count
    FROM public.transactions t
    WHERE t.store_id = p_store_id
      AND t.date >= p_start_date
      AND t.date <= p_end_date
      AND t.status = 'completed'
    GROUP BY t.cashier_id, t.cashier
    ORDER BY total_sales DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_shared_customers.sql
-- MASTER: get_shared_customers
-- Purpose: Retrieves all customers belonging to any store owned by a specific owner
-- Source: scripts/create-shared-customers-rpc.sql

CREATE OR REPLACE FUNCTION public.get_shared_customers(p_owner_id UUID)
RETURNS SETOF public.customers
AS $$
BEGIN
    -- Security Check: Only allow if the caller is the owner or a super_admin
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR id = p_owner_id)
    ) THEN
        RETURN QUERY
        SELECT * FROM public.customers
        WHERE store_id IN (
            SELECT id FROM public.stores WHERE owner_id = p_owner_id
        );
    ELSE
        RAISE EXCEPTION 'Unauthorized: You do not have permission to access these customers.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_shift_summary.sql
-- MASTER: get_shift_summary
-- Purpose: Calculate accurate shift performance metrics

CREATE OR REPLACE FUNCTION public.get_shift_summary(
    p_store_id UUID,
    p_shift_id UUID
) RETURNS JSONB 
AS $$
DECLARE
    v_summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'transactions', COALESCE(COUNT(*), 0),
        'totalSales', COALESCE(SUM(total), 0),
        'totalCashSales', COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total WHEN payment_method = 'split' AND payment_details->>'method1' = 'cash' THEN (payment_details->>'amount1')::NUMERIC WHEN payment_method = 'split' AND payment_details->>'method2' = 'cash' THEN (payment_details->>'amount2')::NUMERIC ELSE 0 END), 0),
        'totalNonCashSales', COALESCE(SUM(CASE WHEN payment_method != 'cash' AND payment_method != 'split' THEN total WHEN payment_method = 'split' THEN (CASE WHEN payment_details->>'method1' != 'cash' THEN (payment_details->>'amount1')::NUMERIC ELSE 0 END) + (CASE WHEN payment_details->>'method2' != 'cash' THEN (payment_details->>'amount2')::NUMERIC ELSE 0 END) ELSE 0 END), 0),
        'totalDiscount', COALESCE(SUM(discount), 0)
    ) INTO v_summary
    FROM transactions WHERE store_id = p_store_id AND shift_id = p_shift_id AND status = 'completed';
    RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_stock_history.sql
-- MASTER: get_stock_history
-- Purpose: Audit-safe retrieval of stock movement history

CREATE OR REPLACE FUNCTION public.get_stock_history(
    p_store_id UUID,
    p_product_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 500
) RETURNS JSONB 
AS $$
DECLARE v_result JSONB;
BEGIN
    SELECT jsonb_agg(row_to_json(sm)::jsonb) INTO v_result FROM (SELECT * FROM stock_movements WHERE store_id = p_store_id AND (p_product_id IS NULL OR product_id = p_product_id) ORDER BY date DESC LIMIT p_limit) sm;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/get_store_initial_snapshot.sql
-- MASTER: get_store_initial_snapshot
-- Purpose: Fetch initial snapshot of a store (categories, counts, stock value)
-- Source: scripts/emergency-restore-inventory.sql (Improved version)

CREATE OR REPLACE FUNCTION public.get_store_initial_snapshot(p_store_id UUID)
RETURNS JSONB
AS $$
DECLARE
    v_categories JSONB;
    v_summary JSONB;
BEGIN
    -- 1. Fetch Categories with Product Counts
    SELECT jsonb_agg(cat_data)
    INTO v_categories
    FROM (
        SELECT 
            c.id,
            c.name,
            c.image_url as "imageUrl",
            COUNT(p.id) FILTER (WHERE p.is_deleted = false) as "productCount"
        FROM public.categories c
        LEFT JOIN public.products p ON p.category_id = c.id
        WHERE c.store_id = p_store_id
        GROUP BY c.id, c.name, c.image_url
        ORDER BY c.name ASC
    ) cat_data;

    -- 2. Fetch Summary Stats
    SELECT jsonb_build_object(
        'totalProducts', COUNT(*) FILTER (WHERE is_deleted = false),
        'totalStock', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) ELSE 0 END),
        'totalValue', SUM(CASE WHEN is_deleted = false THEN COALESCE(stock, 0) * COALESCE(buy_price, 0) ELSE 0 END),
        'outOfStock', COUNT(*) FILTER (WHERE is_deleted = false AND stock <= 0),
        'lowStock', COUNT(*) FILTER (WHERE is_deleted = false AND stock > 0 AND stock <= COALESCE(min_stock, 10))
    )
    INTO v_summary
    FROM public.products
    WHERE store_id = p_store_id;

    RETURN jsonb_build_object(
        'categories', COALESCE(v_categories, '[]'::jsonb),
        'summary', COALESCE(v_summary, '{"totalProducts":0,"totalStock":0,"totalValue":0,"outOfStock":0,"lowStock":0}'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/handle_new_user.sql
-- MASTER: handle_new_user
-- Purpose: Trigger function for Auth.users entry to create profile and store
-- Source: scripts/deploy_prod.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
AS $$
DECLARE
    new_store_id UUID;
    store_name TEXT;
    owner_name TEXT;
    target_role TEXT;
BEGIN
    store_name := new.raw_user_meta_data->>'store_name';
    owner_name := COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'owner_name');
    target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');

    IF store_name IS NOT NULL THEN
        INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email)
        VALUES (
            store_name, 
            'pro',                      
            NOW() + INTERVAL '7 days',  
            NOW() + INTERVAL '7 days',  
            new.id, 
            owner_name, 
            new.email
        )
        RETURNING id INTO new_store_id;
        
        target_role := 'owner';
    ELSE
        BEGIN
            new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            new_store_id := NULL;
        END;
    END IF;

    INSERT INTO public.profiles (id, username, name, email, role, store_id)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(owner_name, new.email),
        new.email, 
        target_role, 
        new_store_id 
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/is_super_admin.sql
-- MASTER: is_super_admin
-- Purpose: Logic to check if authenticated user is super admin
-- Source: scripts/deploy_prod.sql

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN 
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/process_debt_payment.sql
-- MASTER: process_debt_payment
-- Purpose: Record payment towards customer debt and create transaction log
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.process_debt_payment(
    p_store_id UUID,
    p_customer_id TEXT,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB 
AS $$
DECLARE
    v_new_transaction_id TEXT;
BEGIN
    -- 1. Create Transaction ID
    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- 2. Insert Transaction Record
    INSERT INTO transactions (id, store_id, customer_id, type, total, payment_method, date, status, items)
    VALUES (v_new_transaction_id, p_store_id, p_customer_id, 'debt_payment', p_amount, p_payment_method, p_date, 'completed', '[]');

    -- 3. Update Customer Debt
    UPDATE customers
    SET debt = debt - p_amount
    WHERE id = p_customer_id AND store_id = p_store_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/process_opname_session.sql
-- MASTER: process_opname_session
-- Purpose: Save stock opname records, update product stock, and synchronize batches (FIFO)
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.process_opname_session(
    p_store_id UUID,
    p_notes TEXT,
    p_records JSONB -- [{productId, physicalStock, systemStock, difference, differenceValue, notes, buyPrice}]
) RETURNS JSONB 
AS $$
DECLARE
    v_session_id UUID;
    v_record JSONB;
    v_batch RECORD;
    v_remaining_loss NUMERIC;
    v_deduct_qty NUMERIC;
    v_diff NUMERIC;
    v_product_id UUID;
    v_physical_stock NUMERIC;
BEGIN
    -- 1. Create Session
    INSERT INTO stock_opname_sessions (store_id, notes, total_products, total_difference_value, records)
    VALUES (
        p_store_id, 
        p_notes, 
        jsonb_array_length(p_records),
        (SELECT SUM((r->>'differenceValue')::NUMERIC) FROM jsonb_array_elements(p_records) r),
        p_records
    ) RETURNING id INTO v_session_id;

    -- 2. Update Products and Create Movements
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        v_product_id := (v_record->>'productId')::UUID;
        v_diff := (v_record->>'difference')::NUMERIC;
        v_physical_stock := (v_record->>'physicalStock')::NUMERIC;

        -- a. Update Product Stock
        UPDATE products 
        SET stock = v_physical_stock,
            updated_at = NOW()
        WHERE id = v_product_id AND store_id = p_store_id;

        -- b. Handle Batches (FIFO Synchronization)
        BEGIN
            IF v_diff < 0 THEN
                -- Difference is negative (Loss), reduce from batches FIFO
                v_remaining_loss := ABS(v_diff);
                
                FOR v_batch IN 
                    SELECT id, current_qty 
                    FROM batches 
                    WHERE product_id = v_product_id AND store_id = p_store_id AND current_qty > 0 
                    ORDER BY date ASC, created_at ASC
                LOOP
                    IF v_remaining_loss <= 0 THEN EXIT; END IF;
                    
                    v_deduct_qty := LEAST(v_batch.current_qty, v_remaining_loss);
                    
                    UPDATE batches SET current_qty = current_qty - v_deduct_qty WHERE id = v_batch.id;
                    v_remaining_loss := v_remaining_loss - v_deduct_qty;
                END LOOP;
                
            ELSIF v_diff > 0 THEN
                -- Difference is positive (Gain), add a new "Opname Adjustment" batch
                INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note)
                VALUES (
                    p_store_id, 
                    v_product_id, 
                    v_diff, 
                    v_diff, 
                    COALESCE((v_record->>'buyPrice')::NUMERIC, 0), 
                    NOW(), 
                    'Stock Opname Adjustment (Gain)'
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- c. Create Movement
        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
        VALUES (
            p_store_id,
            v_product_id,
            'opname',
            v_diff,
            NOW(),
            COALESCE(v_record->>'notes', 'Stock Opname'),
            v_session_id::TEXT
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/process_refund.sql
-- MASTER: process_refund
-- Purpose: Handle product returns and refunds

CREATE OR REPLACE FUNCTION public.process_refund(
    p_store_id UUID,
    p_transaction_id TEXT,
    p_reason TEXT,
    p_refund_by TEXT
) RETURNS JSONB 
AS $$
DECLARE
    v_item RECORD;
    v_trans_record RECORD;
BEGIN
    SELECT * INTO v_trans_record FROM public.transactions WHERE id = p_transaction_id AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Transaction not found'); END IF;
    IF v_trans_record.status = 'refunded' THEN RETURN jsonb_build_object('success', false, 'error', 'Transaction already refunded'); END IF;

    UPDATE public.transactions SET status = 'refunded', refund_reason = p_reason, refunded_at = NOW(), refund_by = p_refund_by WHERE id = p_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_trans_record.items) AS x(id TEXT, qty NUMERIC, price NUMERIC)
    LOOP
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            UPDATE public.products SET stock = stock + v_item.qty, sold = sold - v_item.qty, revenue = revenue - (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;
            INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'in', v_item.qty, NOW(), 'Refund Transaksi #' || right(p_transaction_id, 6), p_transaction_id);
        END IF;
    END LOOP;

    IF v_trans_record.customer_id IS NOT NULL THEN
        UPDATE public.customers SET total_spent = GREATEST(0, total_spent - v_trans_record.total), loyalty_points = GREATEST(0, loyalty_points - COALESCE(v_trans_record.points_earned, 0))
        WHERE id = v_trans_record.customer_id AND store_id = p_store_id;
        INSERT INTO loyalty_history (store_id, customer_id, points, description, transaction_id, date)
        VALUES (p_store_id, v_trans_record.customer_id, -COALESCE(v_trans_record.points_earned, 0), 'Refund Transaksi #' || p_transaction_id, p_transaction_id, NOW());
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/process_sale.sql
-- MASTER: process_sale
-- Purpose: Critical transaction processing (Sales, Stock Deduction, Loyalty, Shift Stats)

CREATE OR REPLACE FUNCTION public.process_sale(
    p_store_id UUID,
    p_customer_id TEXT,
    p_total NUMERIC,
    p_discount NUMERIC,
    p_payment_method TEXT,
    p_items JSONB,
    p_amount_paid NUMERIC DEFAULT 0,
    p_change NUMERIC DEFAULT 0,
    p_type TEXT DEFAULT 'sale',
    p_rental_session_id UUID DEFAULT NULL,
    p_payment_details JSONB DEFAULT '{}'::jsonb,
    p_points_earned NUMERIC DEFAULT 0,
    p_shift_id UUID DEFAULT NULL,
    p_date TIMESTAMPTZ DEFAULT NOW(),
    p_subtotal NUMERIC DEFAULT NULL,
    p_cashier_id UUID DEFAULT NULL,
    p_cashier_name TEXT DEFAULT NULL
) RETURNS JSONB 
AS $$
DECLARE
    v_item RECORD;
    v_new_transaction_id TEXT;
    v_subtotal NUMERIC;
    v_current_stock NUMERIC;
    v_is_unlimited BOOLEAN;
    v_prod_type TEXT;
    v_customer_name TEXT := NULL;
BEGIN
    v_subtotal := COALESCE(p_subtotal, p_total + p_discount);

    IF p_customer_id IS NOT NULL THEN
        SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND store_id = p_store_id;
    END IF;

    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    INSERT INTO transactions (
        id, store_id, customer_id, customer_name, total, discount, subtotal, payment_method, 
        amount_paid, "change", "type", rental_session_id, payment_details, 
        items, date, status, shift_id, points_earned,
        cashier_id, cashier
    )
    VALUES (
        v_new_transaction_id, p_store_id, p_customer_id, v_customer_name, p_total, p_discount, v_subtotal, p_payment_method, 
        p_amount_paid, p_change, p_type, p_rental_session_id, p_payment_details, 
        p_items, p_date, 'completed', p_shift_id, p_points_earned,
        p_cashier_id, p_cashier_name
    );

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, qty NUMERIC, name TEXT, price NUMERIC, discount NUMERIC, stock_deducted BOOLEAN)
    LOOP
        IF COALESCE(v_item.stock_deducted, false) IS TRUE THEN CONTINUE; END IF;

        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            SELECT stock, COALESCE(is_unlimited, false), COALESCE(type, 'product')
            INTO v_current_stock, v_is_unlimited, v_prod_type
            FROM products WHERE id = v_item.id::UUID AND store_id = p_store_id FOR UPDATE;

            IF v_is_unlimited = false AND v_prod_type != 'service' AND v_current_stock < v_item.qty THEN
                RAISE EXCEPTION 'Stok tidak cukup: % (Sisa: %, Diminta: %)', v_item.name, v_current_stock, v_item.qty;
            END IF;

            UPDATE products 
            SET stock = stock - v_item.qty,
                sold = sold + v_item.qty,
                revenue = revenue + (v_item.qty * (v_item.price - COALESCE(v_item.discount, 0)))
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'sale', -v_item.qty, p_date, 'Penjualan #' || right(v_new_transaction_id, 6), v_new_transaction_id);
        END IF;
    END LOOP;

    IF p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET total_spent = total_spent + p_total,
            loyalty_points = loyalty_points + p_points_earned,
            total_lifetime_points = total_lifetime_points + p_points_earned,
            debt = CASE WHEN p_payment_method = 'debt' THEN debt + p_total ELSE debt END
        WHERE id = p_customer_id AND store_id = p_store_id;

        IF p_points_earned > 0 THEN
            INSERT INTO loyalty_history (store_id, customer_id, points, description, transaction_id, date)
            VALUES (p_store_id, p_customer_id, p_points_earned, 'Penjualan #' || v_new_transaction_id, v_new_transaction_id, p_date);
        END IF;
    END IF;

    IF p_shift_id IS NOT NULL THEN
        UPDATE shifts SET 
            total_sales = COALESCE(total_sales, 0) + p_total,
            total_discount = COALESCE(total_discount, 0) + p_discount,
            total_cash_sales = CASE WHEN p_payment_method = 'cash' THEN COALESCE(total_cash_sales, 0) + p_total ELSE COALESCE(total_cash_sales, 0) END,
            total_non_cash_sales = CASE WHEN p_payment_method != 'cash' THEN COALESCE(total_non_cash_sales, 0) + p_total ELSE COALESCE(total_non_cash_sales, 0) END
        WHERE id = p_shift_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id, 'customer_name', v_customer_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/recalculate_product_stats.sql
-- MASTER: recalculate_product_stats
-- Purpose: Sync sold and revenue stats for all products based on transaction history
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.recalculate_product_stats(
    p_store_id UUID
) RETURNS JSONB 
AS $$
BEGIN
    -- 1. Reset sold and revenue for all products in store
    UPDATE products 
    SET sold = 0
    WHERE store_id = p_store_id;

    -- 2. Update based on transaction history
    WITH product_sales AS (
        SELECT 
            (item->>'id')::UUID as product_id,
            SUM((item->>'qty')::NUMERIC) as total_sold
        FROM transactions,
             jsonb_array_elements(items) as item
        WHERE store_id = p_store_id AND status = 'completed'
        GROUP BY product_id
    )
    UPDATE products p
    SET sold = ps.total_sold
    FROM product_sales ps
    WHERE p.id = ps.product_id AND p.store_id = p_store_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/receive_purchase_order.sql
-- MASTER: receive_purchase_order
-- Purpose: Process PO reception, update stock, and create FIFO batches

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
    p_store_id UUID,
    p_po_id UUID,
    p_items JSONB,
    p_po_updates JSONB
) RETURNS JSONB 
AS $$
DECLARE v_item RECORD;
BEGIN
    UPDATE purchase_orders SET status = 'received', items = p_po_updates->'items', total_amount = (p_po_updates->>'totalAmount')::NUMERIC, updated_at = NOW() WHERE id = p_po_id AND store_id = p_store_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'PO not found'); END IF;
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x("productId" UUID, qty NUMERIC, "buyPrice" NUMERIC, "expiredDate" DATE)
    LOOP
        UPDATE products SET stock = stock + v_item.qty, buy_price = CASE WHEN v_item."buyPrice" > 0 THEN v_item."buyPrice" ELSE buy_price END, updated_at = NOW() WHERE id = v_item."productId" AND store_id = p_store_id;
        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id) VALUES (p_store_id, v_item."productId", 'in', v_item.qty, NOW(), 'Received from PO #' || right(p_po_id::text, 8), p_po_id::text);
        INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date) VALUES (p_store_id, v_item."productId", v_item.qty, v_item.qty, v_item."buyPrice", NOW(), 'PO Reception #' || right(p_po_id::text, 8), v_item."expiredDate");
    END LOOP;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/redeem_stamp_card.sql
-- MASTER: redeem_stamp_card
-- Purpose: Process customer stamp card redemption and award points

CREATE OR REPLACE FUNCTION public.redeem_stamp_card(
    p_stamp_id uuid,
    p_customer_id TEXT,
    p_target_stamps int,
    p_reward_points int
) RETURNS boolean 
AS $$
DECLARE v_current_stamps int; v_store_id uuid;
BEGIN
    SELECT cs.current_stamps, c.store_id INTO v_current_stamps, v_store_id FROM public.customer_stamps cs JOIN public.customers c ON c.id = cs.customer_id WHERE cs.id = p_stamp_id AND cs.customer_id = p_customer_id FOR UPDATE OF cs;
    IF v_current_stamps < p_target_stamps THEN RAISE EXCEPTION 'Not enough stamps'; END IF;
    UPDATE public.customer_stamps SET current_stamps = current_stamps - p_target_stamps, completed_count = COALESCE(completed_count, 0) + 1, last_stamped_at = NOW() WHERE id = p_stamp_id;
    UPDATE public.customers SET loyalty_points = COALESCE(loyalty_points, 0) + p_reward_points WHERE id = p_customer_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/reduce_stock_fifo.sql
-- MASTER: reduce_stock_fifo
-- Purpose: Deduct stock using FIFO logic from available batches

CREATE OR REPLACE FUNCTION public.reduce_stock_fifo(
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_note TEXT DEFAULT 'Pengurangan Stok (FIFO)'
) RETURNS JSONB 
AS $$
DECLARE v_remaining_qty NUMERIC := p_qty; v_batch RECORD; v_total_cogs NUMERIC := 0; v_deduct_qty NUMERIC;
BEGIN
    FOR v_batch IN SELECT id, current_qty, buy_price FROM batches WHERE product_id = p_product_id AND store_id = p_store_id AND current_qty > 0 ORDER BY date ASC, created_at ASC
    LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;
        v_deduct_qty := LEAST(v_batch.current_qty, v_remaining_qty);
        UPDATE batches SET current_qty = current_qty - v_deduct_qty WHERE id = v_batch.id;
        v_total_cogs := v_total_cogs + (v_deduct_qty * v_batch.buy_price);
        v_remaining_qty := v_remaining_qty - v_deduct_qty;
    END LOOP;
    UPDATE products SET stock = stock - p_qty, updated_at = NOW() WHERE id = p_product_id AND store_id = p_store_id;
    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note) VALUES (p_store_id, p_product_id, 'out', -p_qty, NOW(), p_note);
    RETURN jsonb_build_object('success', true, 'cogs', v_total_cogs, 'remaining_needed', v_remaining_qty);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/reject_subscription_invoice.sql
-- MASTER: reject_subscription_invoice
-- Purpose: Admin tool to reject a subscription payment proof
-- Source: scripts/setup_rejection_rpc.sql

CREATE OR REPLACE FUNCTION public.reject_subscription_invoice(
    p_invoice_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS JSONB 
AS $$
DECLARE
    v_invoice RECORD;
BEGIN
    -- 1. Fetch Invoice
    SELECT * INTO v_invoice FROM subscription_invoices WHERE id = p_invoice_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF v_invoice.status = 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot reject: Invoice already approved');
    END IF;

    -- 2. Update Invoice Status to 'failed'
    UPDATE subscription_invoices
    SET status = 'failed',
        approved_at = NOW(),
        approved_by = p_admin_id,
        rejection_reason = p_reason
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/remove_session_item.sql
-- MASTER: remove_session_item
-- Purpose: Remove an item from a rental session and restore stock
-- Source: scripts/deploy_prod.sql

CREATE OR REPLACE FUNCTION public.remove_session_item(
    p_session_id UUID,
    p_store_id UUID,
    p_item_index INT
) RETURNS JSONB 
AS $$
DECLARE
    v_session RECORD;
    v_orders JSONB;
    v_target_item JSONB;
    v_product_id UUID;
    v_qty NUMERIC;
BEGIN
    SELECT * INTO v_session FROM rental_sessions WHERE id = p_session_id AND store_id = p_store_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found');
    END IF;

    v_orders := v_session.orders;
    
    IF p_item_index < 0 OR p_item_index >= jsonb_array_length(v_orders) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid item index');
    END IF;

    v_target_item := v_orders->p_item_index;
    v_product_id := (v_target_item->>'id')::UUID;
    v_qty := (v_target_item->>'qty')::NUMERIC;

    IF (v_target_item->>'stock_deducted')::BOOLEAN IS TRUE THEN
        UPDATE products 
        SET stock = stock + v_qty 
        WHERE id = v_product_id AND store_id = p_store_id;

        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
        VALUES (p_store_id, v_product_id, 'in', v_qty, NOW(), 'Restored from Service Session', p_session_id::TEXT);
    END IF;

    UPDATE rental_sessions
    SET orders = v_orders - p_item_index
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/reset_loyalty_points.sql
-- MASTER: reset_loyalty_points
-- Purpose: Reset all customer loyalty points for a specific store

CREATE OR REPLACE FUNCTION public.reset_loyalty_points(
    p_store_id UUID
) RETURNS VOID 
AS $$
BEGIN 
    UPDATE public.customers SET loyalty_points = 0 WHERE store_id = p_store_id; 
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/reset_store_data.sql
-- MASTER: reset_store_data
-- Purpose: EMERGENCY utility to wipe all transactional data for a store

CREATE OR REPLACE FUNCTION public.reset_store_data(
    p_store_id UUID
) RETURNS JSONB 
AS $$
BEGIN
    DELETE FROM public.transactions WHERE store_id = p_store_id;
    DELETE FROM public.stock_movements WHERE store_id = p_store_id;
    DELETE FROM public.batches WHERE store_id = p_store_id;
    DELETE FROM public.purchase_orders WHERE store_id = p_store_id;
    DELETE FROM public.loyalty_history WHERE store_id = p_store_id;
    DELETE FROM public.shift_movements WHERE store_id = p_store_id;
    DELETE FROM public.shifts WHERE store_id = p_store_id;
    
    -- Reset product stock and counters
    UPDATE public.products 
    SET stock = 0, sold = 0, revenue = 0 
    WHERE store_id = p_store_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/reupload_payment_proof.sql
-- MASTER: reupload_payment_proof
-- Purpose: Allow owners to re-upload payment proofs for rejected subscription invoices
-- Source: scripts/setup_reupload_rpc.sql

CREATE OR REPLACE FUNCTION public.reupload_payment_proof(
    p_invoice_id UUID,
    p_proof_url TEXT
) RETURNS JSONB 
AS $$
DECLARE
    v_store_id UUID;
    v_user_store_id UUID;
    v_current_status TEXT;
BEGIN
    v_user_store_id := get_my_store_id();
    
    SELECT store_id, status INTO v_store_id, v_current_status
    FROM public.subscription_invoices
    WHERE id = p_invoice_id;

    IF v_store_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invoice not found');
    END IF;

    IF v_store_id IS DISTINCT FROM v_user_store_id THEN
         RETURN jsonb_build_object('success', false, 'message', 'Unauthorized access to this invoice');
    END IF;

    UPDATE public.subscription_invoices
    SET proof_url = p_proof_url,
        status = 'pending',
        rejection_reason = NULL,
        created_at = NOW() 
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/sync_owner_plan_to_stores.sql
-- MASTER: sync_owner_plan_to_stores
-- Purpose: Syncs the Owner's plan and expiry date from their profile to ALL their stores
-- Source: scripts/sync-owner-plan-to-stores.sql

CREATE OR REPLACE FUNCTION public.sync_owner_plan_to_stores()
RETURNS TRIGGER 
AS $$
BEGIN
    -- 1. Only update stores if plan or expiry date changed in the profile
    IF OLD.plan IS DISTINCT FROM NEW.plan OR OLD.plan_expiry_date IS DISTINCT FROM NEW.plan_expiry_date THEN
        UPDATE public.stores
        SET 
            plan = NEW.plan,
            plan_expiry_date = NEW.plan_expiry_date
        WHERE owner_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FROM sql/functions/void_transaction.sql
-- MASTER: void_transaction
-- Purpose: Cancel transaction with stock return and debt reversal

CREATE OR REPLACE FUNCTION public.void_transaction(
    p_store_id UUID,
    p_transaction_id TEXT,
    p_reason TEXT,
    p_void_by TEXT
) RETURNS JSONB 
AS $$
DECLARE
    v_item RECORD;
    v_trans_record RECORD;
BEGIN
    SELECT * INTO v_trans_record FROM public.transactions WHERE id = p_transaction_id AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan'); END IF;
    IF v_trans_record.status = 'void' THEN RETURN jsonb_build_object('success', false, 'error', 'Transaksi sudah dibatalkan sebelumnya'); END IF;

    UPDATE public.transactions SET status = 'void', void_reason = p_reason, voided_at = NOW(), void_by = p_void_by WHERE id = p_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_trans_record.items) AS x(id TEXT, qty NUMERIC, price NUMERIC, stock_deducted BOOLEAN)
    LOOP
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND COALESCE(v_item.stock_deducted, true) IS TRUE THEN
            UPDATE public.products SET stock = stock + v_item.qty, sold = sold - v_item.qty, revenue = revenue - (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'in', v_item.qty, NOW(), 'Void Transaksi #' || right(p_transaction_id, 6), p_transaction_id);
        END IF;
    END LOOP;

    IF v_trans_record.customer_id IS NOT NULL THEN
        UPDATE public.customers SET total_spent = GREATEST(0, total_spent - v_trans_record.total), loyalty_points = GREATEST(0, loyalty_points - COALESCE(v_trans_record.points_earned, 0)),
            debt = CASE WHEN v_trans_record.payment_method = 'debt' THEN GREATEST(0, debt - v_trans_record.total) ELSE debt END
        WHERE id = v_trans_record.customer_id AND store_id = p_store_id;
        DELETE FROM loyalty_history WHERE transaction_id = p_transaction_id AND store_id = p_store_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;