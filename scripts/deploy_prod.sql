-- =====================================================================================
-- PRODUCTION DEPLOYMENT SCRIPT (v0.11.0)
-- Merges: Consolidation, Loyalty, Rental, Pagination, Auth, and Security Fixes
-- =====================================================================================

BEGIN;

-- 1. BASE SCHEMA CONSOLIDATION
-- =====================================================================================

-- 1.1 PROFILES
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_force_logout_at TIMESTAMPTZ;
END $$;

-- 1.2 STORES
DO $$ BEGIN
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS enable_rental BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'pro';
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS enable_discount BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS discount_pin TEXT;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS service_charge NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'exclusive';
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_name_unique ON public.stores(name);

-- 1.3 PRODUCTS
DO $$ BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'product';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS revenue NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percent';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN DEFAULT false;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_unit TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS conversion_to_unit NUMERIC(15, 2);
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight NUMERIC(15, 2);
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rack_location TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_bundling_enabled BOOLEAN DEFAULT false;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'standard';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]'::jsonb;
END $$;

-- 1.4 TRANSACTIONS
DO $$ BEGIN
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "change" NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS points_earned NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'sale';
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS rental_session_id UUID;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) DEFAULT 0;
END $$;

-- 1.5 SHIFT MOVEMENTS
DO $$ BEGIN
    ALTER TABLE public.shift_movements ADD COLUMN IF NOT EXISTS expense_group TEXT DEFAULT 'operational';
END $$;

-- 1.6 SUPPLIERS
DO $$ BEGIN
    ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
END $$;

-- 1.7 AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 1.8 RENTAL TABLES (Pets, Medical, Rooms)
CREATE TABLE IF NOT EXISTS pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'Cat',
    breed TEXT,
    gender TEXT,
    birth_date TIMESTAMPTZ,
    weight NUMERIC(10, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
    date TIMESTAMPTZ,
    diagnosis TEXT,
    treatment TEXT,
    notes TEXT,
    doctor_name TEXT,
    next_visit TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    capacity INTEGER DEFAULT 1,
    price_per_night NUMERIC(15, 2) DEFAULT 0,
    status TEXT DEFAULT 'available',
    features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LOYALTY FEATURE
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.loyalty_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points NUMERIC(15, 2) NOT NULL,
    description TEXT,
    transaction_id TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure store_id exists if table was created previously without it
DO $$ BEGIN
    ALTER TABLE public.loyalty_history ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;
END $$;

-- 3. RENTAL RPCs
-- =====================================================================================
CREATE OR REPLACE FUNCTION add_session_item(
    p_session_id UUID,
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_price NUMERIC
) RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_session_item(
    p_session_id UUID,
    p_store_id UUID,
    p_item_index INT
) RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql;

-- 4. CRITICAL: MERGED PROCESS_SALE (Loyalty + Rental Stock Checks)
-- =====================================================================================
CREATE OR REPLACE FUNCTION process_sale(
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
    p_subtotal NUMERIC DEFAULT NULL
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_transaction_id TEXT;
    v_item RECORD;
    v_new_transaction_id TEXT;
    v_subtotal NUMERIC;
    v_customer_name TEXT := NULL;
BEGIN
    -- Calculate subtotal if not provided
    v_subtotal := COALESCE(p_subtotal, p_total + p_discount);

    -- Fetch customer name for denormalization
    IF p_customer_id IS NOT NULL THEN
        SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND store_id = p_store_id;
    END IF;

    -- 1. Create Transaction ID
    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- 2. Insert Transaction Record
    INSERT INTO transactions (
        id, store_id, customer_id, customer_name, total, discount, subtotal, payment_method, 
        amount_paid, "change", "type", rental_session_id, payment_details, 
        items, date, status, shift_id, points_earned
    )
    VALUES (
        v_new_transaction_id, p_store_id, p_customer_id, v_customer_name, p_total, p_discount, v_subtotal, p_payment_method, 
        p_amount_paid, p_change, p_type, p_rental_session_id, p_payment_details, 
        p_items, p_date, 'completed', p_shift_id, p_points_earned
    );

    -- 3. Process each item (Stock & Sold Stats)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        id TEXT, 
        qty NUMERIC, 
        name TEXT, 
        price NUMERIC,
        stock_deducted BOOLEAN
    )
    LOOP
        -- MERGED LOGIC: Check stock_deducted flag (from Rental/Service items)
        IF v_item.stock_deducted IS TRUE THEN
            -- Skip stock deduction, but maybe should record sold stats? 
            -- For now, consistency with rental logic: Just skip.
            CONTINUE;
        END IF;

        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            UPDATE products 
            SET stock = stock - v_item.qty,
                sold = sold + v_item.qty,
                revenue = revenue + (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'sale', -v_item.qty, p_date, 'Penjualan #' || right(v_new_transaction_id, 6), v_new_transaction_id);
        END IF;
    END LOOP;

    -- 4. Update Customer Points & History (MERGED LOYALTY LOGIC)
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

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id, 'customer_name', v_customer_name);
END;
$$;

-- 5. REFUND PROCESS (Loyalty Support)
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.process_refund(
    p_store_id UUID,
    p_transaction_id TEXT,
    p_reason TEXT,
    p_refund_by TEXT
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_trans_record RECORD;
BEGIN
    SELECT * INTO v_trans_record FROM public.transactions 
    WHERE id = p_transaction_id AND store_id = p_store_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF v_trans_record.status = 'refunded' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction already refunded');
    END IF;

    UPDATE public.transactions 
    SET status = 'refunded',
        refund_reason = p_reason,
        refunded_at = NOW(),
        refund_by = p_refund_by
    WHERE id = p_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_trans_record.items) AS x(id TEXT, qty NUMERIC, price NUMERIC)
    LOOP
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            UPDATE public.products 
            SET stock = stock + v_item.qty,
                sold = sold - v_item.qty,
                revenue = revenue - (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'in', v_item.qty, NOW(), 'Refund Transaksi #' || right(p_transaction_id, 6), p_transaction_id);
        END IF;
    END LOOP;

    -- Update Customer Data & Points History
    IF v_trans_record.customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET total_spent = GREATEST(0, total_spent - v_trans_record.total),
            loyalty_points = GREATEST(0, loyalty_points - v_trans_record.points_earned)
        WHERE id = v_trans_record.customer_id AND store_id = p_store_id;

        IF v_trans_record.points_earned > 0 THEN
            INSERT INTO loyalty_history (store_id, customer_id, points, description, transaction_id, date)
            VALUES (p_store_id, v_trans_record.customer_id, -v_trans_record.points_earned, 'Refund Transaksi #' || p_transaction_id, p_transaction_id, NOW());
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 6. PRODUCTS SERVER PAGINATION RPC
-- =====================================================================================
DROP FUNCTION IF EXISTS get_products_page(uuid,integer,integer,text,text,text,text,text);
DROP FUNCTION IF EXISTS get_products_page(text,integer,integer,text,text,text,text,text);

CREATE OR REPLACE FUNCTION get_products_page(
    p_store_id UUID,
    p_page INT,
    p_page_size INT,
    p_search TEXT DEFAULT '',
    p_category TEXT DEFAULT 'all',
    p_satuan_po TEXT DEFAULT 'all',
    p_sort_key TEXT DEFAULT 'name',
    p_sort_dir TEXT DEFAULT 'asc'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- CRITICAL: Bypass RLS, filter by p_store_id internally
SET search_path = public
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
$$;


-- 7. AUTH TRIGGER (Handle New User with 7-Day Trial)
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 8. SECURITY & RLS FIXES (Super Admin Access)
-- =====================================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY[
        'categories', 'products', 'transactions', 'customers', 
        'point_adjustments', 'suppliers', 'sales_targets', 'promotions',
        'purchase_orders', 'shifts', 'shift_movements', 'bookings',
        'cash_flow', 'audit_logs', 'shopping_recommendations', 
        'rental_units', 'rental_sessions', 'stock_movements', 'batches',
        'stock_opname_sessions', 'loyalty_history'
    ];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables 
    LOOP 
        -- Check if table exists before trying to apply policy
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl_name) THEN
            EXECUTE format('
                DROP POLICY IF EXISTS multitenant_%I_policy ON %I;
                CREATE POLICY multitenant_%I_policy ON %I
                FOR ALL USING (
                    store_id = get_my_store_id() OR is_super_admin()
                );', tbl_name, tbl_name, tbl_name, tbl_name);
        END IF;
    END LOOP;
END $$;


-- 9. DASHBOARD RPCs (SECURITY DEFINER)
-- =====================================================================================

-- 9a. get_dashboard_stats
DROP FUNCTION IF EXISTS get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS get_dashboard_stats(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_period TEXT DEFAULT 'day'
) RETURNS JSONB 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_total_sales NUMERIC := 0;
    v_total_transactions INT := 0;
    v_avg_order NUMERIC := 0;
    v_chart_data JSONB;
    v_category_stats JSONB;
    v_top_products JSONB;
    v_recent_transactions JSONB;
BEGIN
    -- 1. General Stats
    SELECT COALESCE(SUM(total), 0), COUNT(*), COALESCE(AVG(total), 0)
    INTO v_total_sales, v_total_transactions, v_avg_order
    FROM transactions
    WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date
      AND (status IS NULL OR status IN ('completed', 'success', 'paid'));

    -- 2. Chart Data
    IF p_period = 'hour' THEN
        SELECT jsonb_agg(stats) INTO v_chart_data FROM (
            SELECT to_char(date_trunc('hour', date), 'HH24:00') as name, SUM(total) as total
            FROM transactions WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date
              AND (status IS NULL OR status IN ('completed', 'success', 'paid'))
            GROUP BY 1, EXTRACT(HOUR FROM date) ORDER BY EXTRACT(HOUR FROM date)
        ) stats;
    ELSE
        SELECT jsonb_agg(stats) INTO v_chart_data FROM (
            SELECT to_char(date, 'DD Mon') as name, SUM(total) as total
            FROM transactions WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date
              AND (status IS NULL OR status IN ('completed', 'success', 'paid'))
            GROUP BY 1, date_trunc('day', date) ORDER BY date_trunc('day', date)
        ) stats;
    END IF;

    -- 3. Category Stats (uses TEXT comparison for NanoID product IDs)
    SELECT jsonb_agg(dataset) INTO v_category_stats FROM (
        SELECT COALESCE(c.name, 'Uncategorized') as name,
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as value
        FROM transactions t, jsonb_array_elements(t.items) as item
        LEFT JOIN products p ON p.id::TEXT = (item->>'id')
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE t.store_id = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date
          AND (t.status IS NULL OR t.status IN ('completed', 'success', 'paid'))
        GROUP BY 1 ORDER BY 2 DESC LIMIT 8
    ) dataset;

    -- 4. Top Products
    SELECT jsonb_agg(t) INTO v_top_products FROM (
        SELECT item->>'name' as name, SUM((item->>'qty')::numeric) as sold,
            SUM((item->>'qty')::numeric * (item->>'price')::numeric) as revenue
        FROM transactions tx, jsonb_array_elements(tx.items) as item
        WHERE tx.store_id = p_store_id AND tx.date >= p_start_date AND tx.date <= p_end_date
          AND (tx.status IS NULL OR tx.status IN ('completed', 'success', 'paid'))
        GROUP BY 1 ORDER BY 3 DESC LIMIT 10
    ) t;

    -- 5. Recent Transactions (no date filter)
    SELECT jsonb_agg(r) INTO v_recent_transactions FROM (
        SELECT id, cashier, date, total, status FROM transactions
        WHERE store_id = p_store_id AND (status IS NULL OR status IN ('completed', 'success', 'paid'))
        ORDER BY date DESC LIMIT 5
    ) r;

    RETURN jsonb_build_object(
        'totalSales', v_total_sales, 'totalTransactions', v_total_transactions, 'avgOrder', v_avg_order,
        'chartData', COALESCE(v_chart_data, '[]'::jsonb),
        'categoryData', COALESCE(v_category_stats, '[]'::jsonb),
        'topProducts', COALESCE(v_top_products, '[]'::jsonb),
        'recentTransactions', COALESCE(v_recent_transactions, '[]'::jsonb)
    );
END;
$$;

-- 9b. get_dashboard_monthly_summary
DROP FUNCTION IF EXISTS public.get_dashboard_monthly_summary(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.get_dashboard_monthly_summary(
    p_store_id UUID, p_year INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result JSONB;
BEGIN
    WITH monthly_data AS (
        SELECT EXTRACT(MONTH FROM t.date)::INTEGER as month_num, TO_CHAR(t.date, 'Mon') as month_name,
            COALESCE(SUM(t.total), 0) as total_revenue, COUNT(*) as transaction_count,
            COALESCE(SUM(t.total) - SUM(
                (SELECT COALESCE(SUM((item->>'qty')::NUMERIC * COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0)), 0)
                 FROM jsonb_array_elements(t.items) as item)
            ), 0) as total_profit,
            COUNT(DISTINCT DATE(t.date)) as days_with_sales
        FROM transactions t
        WHERE t.store_id = p_store_id AND EXTRACT(YEAR FROM t.date) = p_year AND (t.status IS NULL OR t.status = 'completed')
        GROUP BY EXTRACT(MONTH FROM t.date), TO_CHAR(t.date, 'Mon')
    ),
    monthly_expenses AS (
        SELECT EXTRACT(MONTH FROM cf.date)::INTEGER as month_num, COALESCE(SUM(cf.amount), 0) as total_opex
        FROM cash_flow cf
        WHERE cf.store_id = p_store_id AND EXTRACT(YEAR FROM cf.date) = p_year AND cf.type = 'out' AND (cf.expense_group IS NULL OR cf.expense_group != 'asset')
        GROUP BY EXTRACT(MONTH FROM cf.date)
    ),
    all_months AS (SELECT generate_series(1, 12) as month_num)
    SELECT jsonb_agg(
        jsonb_build_object(
            'monthIndex', am.month_num - 1,
            'name', TO_CHAR(DATE '2020-01-01' + ((am.month_num - 1) || ' month')::interval, 'Mon'),
            'totalRevenue', COALESCE(md.total_revenue, 0), 'totalProfit', COALESCE(md.total_profit, 0),
            'totalOpEx', COALESCE(me.total_opex, 0), 'transactionsCount', COALESCE(md.transaction_count, 0),
            'daysWithSales', COALESCE(md.days_with_sales, 0),
            'avgDailyRevenue', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN COALESCE(md.total_revenue, 0) / md.days_with_sales ELSE 0 END,
            'avgDailyProfit', CASE WHEN COALESCE(md.days_with_sales, 0) > 0 THEN COALESCE(md.total_profit, 0) / md.days_with_sales ELSE 0 END
        ) ORDER BY am.month_num
    ) INTO v_result
    FROM all_months am LEFT JOIN monthly_data md ON md.month_num = am.month_num LEFT JOIN monthly_expenses me ON me.month_num = am.month_num;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 10. GRANT PERMISSIONS
-- =====================================================================================
GRANT EXECUTE ON FUNCTION public.get_my_store_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_monthly_summary(UUID, INTEGER) TO authenticated;

-- 11. FINAL NOTIFICATION
NOTIFY pgrst, 'reload schema';

COMMIT;
