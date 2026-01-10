-- Initial Supabase Schema for Kasir Pro

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper Function to get Store ID (Security Definer to bypass recursion)
CREATE OR REPLACE FUNCTION public.get_my_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Stores Table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID, -- Links to auth.users
    owner_name TEXT,
    email TEXT,
    plan TEXT DEFAULT 'free',
    trial_ends_at TIMESTAMPTZ,
    plan_expiry_date TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    address TEXT,
    phone TEXT,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    enable_sales_performance BOOLEAN DEFAULT FALSE,
    pet_care_enabled BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Users Profile Table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT UNIQUE,
    role TEXT DEFAULT 'staff',
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'offline',
    last_login TIMESTAMPTZ,
    photo TEXT,
    pin TEXT,
    password TEXT,
    pet_care_access BOOLEAN DEFAULT FALSE,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', 'admin');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_store_id UUID;
BEGIN
  -- 1. If store_name is present, this is a New Resgistration (Owner)
  IF new.raw_user_meta_data->>'store_name' IS NOT NULL THEN
     -- Create Store
     INSERT INTO public.stores (name, owner_id, owner_name, email)
     VALUES (
        new.raw_user_meta_data->>'store_name',
        new.id,
        new.raw_user_meta_data->>'name',
        new.email
     ) RETURNING id INTO new_store_id;

     -- Create Profile with provided role (default to owner for first user)
     INSERT INTO public.profiles (id, email, name, role, store_id)
     VALUES (new.id, new.email, new.raw_user_meta_data->>'name', COALESCE(new.raw_user_meta_data->>'role', 'owner'), new_store_id);

  ELSE
     -- 2. Otherwise, it might be a Staff invitation or generic signup
     -- Create Profile (role and store_id might be null or provided in metadata)
     INSERT INTO public.profiles (id, email, name, role, store_id)
     VALUES (
        new.id, 
        new.email, 
        new.raw_user_meta_data->>'name', 
        COALESCE(new.raw_user_meta_data->>'role', 'staff'),
        (new.raw_user_meta_data->>'store_id')::UUID
     );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    barcode TEXT,
    buy_price NUMERIC(15, 2) DEFAULT 0,
    sell_price NUMERIC(15, 2) DEFAULT 0,
    stock NUMERIC(15, 2) DEFAULT 0,
    unit TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY, -- Using custom string ID to preserve Firebase IDs if needed, or UUID
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id TEXT, -- Link to customers table
    customer_name TEXT,
    cashier TEXT,
    cashier_id UUID REFERENCES profiles(id),
    date TIMESTAMPTZ DEFAULT NOW(),
    total NUMERIC(15, 2) NOT NULL,
    discount NUMERIC(15, 2) DEFAULT 0,
    tax NUMERIC(15, 2) DEFAULT 0,
    payment_method TEXT,
    payment_details JSONB DEFAULT '{}'::jsonb, -- New field for split payments etc
    status TEXT DEFAULT 'success',
    items JSONB NOT NULL, -- Detailed items list
    void_reason TEXT,
    shift_id UUID, -- New field for shift tracking
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, -- Use phone number as ID as per original logic
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    total_spent NUMERIC(15, 2) DEFAULT 0,
    debt NUMERIC(15, 2) DEFAULT 0,
    loyalty_points NUMERIC(15, 2) DEFAULT 0,
    total_lifetime_points NUMERIC(15, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Subscription Plans (System Settings)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    max_products INT,
    max_stores INT,
    max_staff INT,
    price_id TEXT, -- For Stripe/Payment integration
    features JSONB DEFAULT '[]'
);

INSERT INTO subscription_plans (id, name, max_products, max_stores, max_staff) VALUES
('free', 'Free', 50, 1, 1),
('pro', 'Pro', 500, 3, 5),
('enterprise', 'Enterprise', 10000, 10, 50)
ON CONFLICT (id) DO NOTHING;

-- 8. Point Adjustments Table
CREATE TABLE IF NOT EXISTS point_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    customer_name TEXT,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    type TEXT,
    amount NUMERIC(15, 2),
    reason TEXT,
    performed_by UUID, -- Links to profiles(id)
    performed_by_name TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    previous_balance NUMERIC(15, 2),
    new_balance NUMERIC(15, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Sales Targets Table
CREATE TABLE IF NOT EXISTS sales_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT, -- e.g., 'daily', 'monthly'
    target_amount NUMERIC(15, 2),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Promotions Table
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    discount_value NUMERIC(15, 2),
    target_ids JSONB DEFAULT '[]'::jsonb,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    min_purchase NUMERIC(15, 2) DEFAULT 0,
    usage_limit INTEGER DEFAULT 0,
    current_usage INTEGER DEFAULT 0,
    allow_multiples BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Purchase Orders Table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    total_amount NUMERIC(15, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending', -- 'pending', 'received', 'cancelled'
    items JSONB NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Shifts Table
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    cashier_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    cashier_name TEXT,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    initial_cash NUMERIC(15, 2) DEFAULT 0,
    final_cash NUMERIC(15, 2) DEFAULT 0,
    final_non_cash NUMERIC(15, 2) DEFAULT 0,
    expected_cash NUMERIC(15, 2) DEFAULT 0,
    expected_non_cash NUMERIC(15, 2) DEFAULT 0,
    cash_difference NUMERIC(15, 2) DEFAULT 0,
    non_cash_difference NUMERIC(15, 2) DEFAULT 0,
    status TEXT DEFAULT 'active', -- 'active', 'closed'
    notes TEXT,
    terminated_by_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Shift Movements (Cash In/Out)
CREATE TABLE IF NOT EXISTS shift_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    type TEXT, -- 'in', 'out'
    amount NUMERIC(15, 2) DEFAULT 0,
    reason TEXT,
    category TEXT DEFAULT 'General',
    cashier TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security)
-- 1. Enable RLS on all tables
-- This will be executed at the end of the file to ensure all tables exist.

-- 2. Define Basic Multitenant Policies
DROP POLICY IF EXISTS multitenant_stores_policy ON stores;
CREATE POLICY multitenant_stores_policy ON stores
FOR ALL USING (
    owner_id = auth.uid() OR 
    id = get_my_store_id()
);

DROP POLICY IF EXISTS multitenant_profiles_policy ON profiles;
CREATE POLICY multitenant_profiles_policy ON profiles
FOR ALL USING (
    id = auth.uid() OR 
    store_id = get_my_store_id()
);

-- 11. RPC: Process Sale (Ensures Atomicity)
-- This function will handle:
-- 1. Create transaction record
-- 2. Deduct stock from products
-- 3. Create stock movements
-- 4. Update customer points/spent/debt
-- (Note: FIFO Batches logic will be added in a more granular version)

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
) RETURNS JSONB AS $$
DECLARE
    v_transaction_id TEXT;
    v_item RECORD;
    v_new_transaction_id TEXT;
    v_subtotal NUMERIC;
BEGIN
    -- Calculate subtotal if not provided
    v_subtotal := COALESCE(p_subtotal, p_total + p_discount);

    -- 1. Create Transaction ID (YYMMDDHHmmss + random)
    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- 2. Insert Transaction Record
    INSERT INTO transactions (
        id, store_id, customer_id, total, discount, subtotal, payment_method, 
        amount_paid, "change", "type", rental_session_id, payment_details, 
        items, date, status, shift_id, points_earned
    )
    VALUES (
        v_new_transaction_id, p_store_id, p_customer_id, p_total, p_discount, v_subtotal, p_payment_method, 
        p_amount_paid, p_change, p_type, p_rental_session_id, p_payment_details, 
        p_items, p_date, 'completed', p_shift_id, p_points_earned
    );

    -- 3. Process each item
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, qty NUMERIC, name TEXT, price NUMERIC)
    LOOP
        -- Only update stock if ID is a valid UUID (ignore 'rental-fee' or other custom strings)
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            -- Update Product Stock
            UPDATE products 
            SET stock = stock - v_item.qty,
                sold = sold + v_item.qty,
                revenue = revenue + (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            -- Create Stock Movement
            INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'sale', -v_item.qty, p_date, 'Penjualan #' || right(v_new_transaction_id, 6), v_new_transaction_id);
        END IF;
    END LOOP;

    -- 4. Update Customer Data
    IF p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET total_spent = total_spent + p_total,
            loyalty_points = loyalty_points + p_points_earned,
            total_lifetime_points = total_lifetime_points + p_points_earned,
            debt = CASE WHEN p_payment_method = 'debt' THEN debt + p_total ELSE debt END
        WHERE id = p_customer_id AND store_id = p_store_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 12. RPC: Void Transaction
CREATE OR REPLACE FUNCTION void_transaction(
    p_store_id UUID,
    p_transaction_id TEXT,
    p_reason TEXT,
    p_void_by TEXT
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_trans_record RECORD;
    v_points_to_deduct NUMERIC;
BEGIN
    -- 1. Get Transaction Data
    SELECT * INTO v_trans_record FROM transactions 
    WHERE id = p_transaction_id AND store_id = p_store_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF v_trans_record.status = 'void' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction already voided');
    END IF;

    -- 2. Mark Transaction as Void
    UPDATE transactions 
    SET status = 'void',
        void_reason = p_reason,
        voided_at = NOW(),
        void_by = p_void_by
    WHERE id = p_transaction_id;

    -- 3. Restore Stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_trans_record.items) AS x(id UUID, qty NUMERIC)
    LOOP
        UPDATE products 
        SET stock = stock + v_item.qty
        WHERE id = v_item.id AND store_id = p_store_id;

        -- Record restoration movement
        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
        VALUES (p_store_id, v_item.id, 'in', v_item.qty, NOW(), 'Void Transaksi #' || right(p_transaction_id, 6), p_transaction_id);
    END LOOP;

    -- 4. Reverse Customer Data
    -- Note: Points earned is slightly tricky without separate field, 
    -- but for this draft we assume they are passed or calculated.
    -- In production, we'd store points_earned as a column in transactions.
    
    IF v_trans_record.customer_id IS NOT NULL THEN
        UPDATE customers
        SET total_spent = total_spent - v_trans_record.total,
            debt = CASE WHEN v_trans_record.payment_method = 'debt' THEN debt - v_trans_record.total ELSE debt END
        WHERE id = v_trans_record.customer_id AND store_id = p_store_id;
    END IF;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 20. RPC: Recalculate Product Stats
CREATE OR REPLACE FUNCTION recalculate_product_stats(
    p_store_id UUID
) RETURNS JSONB AS $$
BEGIN
    -- 1. Reset sold and revenue for all products in store
    UPDATE products 
    SET sold = 0
    WHERE store_id = p_store_id;

    -- 2. Update based on transaction history
    -- We join products with transaction items
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
$$ LANGUAGE plpgsql;

-- 18. RPC: Bulk Add Products
CREATE OR REPLACE FUNCTION bulk_add_products(
    p_store_id UUID,
    p_products JSONB
) RETURNS JSONB AS $$
DECLARE
    v_product JSONB;
    v_cat_id UUID;
    v_new_prod_id UUID;
    v_added_count INT := 0;
    v_skipped_count INT := 0;
    v_new_cats_count INT := 0;
BEGIN
    FOR v_product IN SELECT * FROM jsonb_array_elements(p_products)
    LOOP
        -- Check duplicate barcode
        IF v_product->>'barcode' IS NOT NULL AND EXISTS (
            SELECT 1 FROM products WHERE store_id = p_store_id AND barcode = v_product->>'barcode'
        ) THEN
            v_skipped_count := v_skipped_count + 1;
            CONTINUE;
        END IF;

        -- Handle Category
        IF v_product->>'category' IS NOT NULL THEN
            SELECT id INTO v_cat_id FROM categories WHERE store_id = p_store_id AND LOWER(TRIM(name)) = LOWER(TRIM(v_product->>'category'));
            IF NOT FOUND THEN
                INSERT INTO categories (store_id, name) VALUES (p_store_id, TRIM(v_product->>'category')) RETURNING id INTO v_cat_id;
                v_new_cats_count := v_new_cats_count + 1;
            END IF;
        ELSE
            v_cat_id := NULL;
        END IF;

        -- Insert Product
        INSERT INTO products (
            store_id, category_id, name, barcode, buy_price, sell_price, stock, unit, min_stock, type
        ) VALUES (
            p_store_id,
            v_cat_id,
            v_product->>'name',
            v_product->>'barcode',
            (v_product->>'buyPrice')::NUMERIC,
            (v_product->>'sellPrice')::NUMERIC,
            (v_product->>'stock')::NUMERIC,
            v_product->>'unit',
            (v_product->>'minStock')::NUMERIC,
            COALESCE(v_product->>'type', 'product')
        ) RETURNING id INTO v_new_prod_id;

        v_added_count := v_added_count + 1;

        -- Initial Stock Tracking
        IF (v_product->>'stock')::NUMERIC > 0 THEN
            -- Record Movement
            INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_new_prod_id, 'in', (v_product->>'stock')::NUMERIC, NOW(), 'Initial Stock (Bulk Import)', v_new_prod_id::TEXT);

            -- Create Batch
            INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note)
            VALUES (p_store_id, v_new_prod_id, (v_product->>'stock')::NUMERIC, (v_product->>'stock')::NUMERIC, (v_product->>'buyPrice')::NUMERIC, NOW(), 'Initial Stock (Bulk Import)');
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'added_count', v_added_count,
        'skipped_count', v_skipped_count,
        'new_categories_count', v_new_cats_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 19. RPC: Bulk Update Stock
CREATE OR REPLACE FUNCTION bulk_update_stock(
    p_store_id UUID,
    p_updates JSONB
) RETURNS JSONB AS $$
DECLARE
    v_update JSONB;
    v_prod_id UUID;
    v_success_count INT := 0;
    v_not_found_count INT := 0;
BEGIN
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        -- Find product by barcode
        SELECT id INTO v_prod_id FROM products 
        WHERE store_id = p_store_id AND barcode = v_update->>'barcode' AND is_deleted = false;

        IF NOT FOUND THEN
            v_not_found_count := v_not_found_count + 1;
            CONTINUE;
        END IF;

        -- Update product stock and prices
        UPDATE products 
        SET stock = stock + (v_update->>'qty')::NUMERIC,
            buy_price = CASE WHEN (v_update->>'buyPrice')::NUMERIC > 0 THEN (v_update->>'buyPrice')::NUMERIC ELSE buy_price END,
            sell_price = CASE WHEN (v_update->>'sellPrice')::NUMERIC > 0 THEN (v_update->>'sellPrice')::NUMERIC ELSE sell_price END
        WHERE id = v_prod_id;

        -- Record movement
        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note)
        VALUES (p_store_id, v_prod_id, 'in', (v_update->>'qty')::NUMERIC, NOW(), COALESCE(v_update->>'note', 'Bulk Stock Update'));

        -- Create Batch
        INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note)
        VALUES (p_store_id, v_prod_id, (v_update->>'qty')::NUMERIC, (v_update->>'qty')::NUMERIC, COALESCE((v_update->>'buyPrice')::NUMERIC, 0), NOW(), COALESCE(v_update->>'note', 'Bulk Stock Update'));

        v_success_count := v_success_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'success_count', v_success_count,
        'not_found_count', v_not_found_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 21. RPC: Process Opname Session
CREATE OR REPLACE FUNCTION process_opname_session(
    p_store_id UUID,
    p_notes TEXT,
    p_records JSONB -- [{product_id, physical_stock, system_stock, difference, difference_value, notes}]
) RETURNS JSONB AS $$
DECLARE
    v_session_id UUID;
    v_record JSONB;
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
        -- Update Product
        UPDATE products 
        SET stock = (v_record->>'physicalStock')::NUMERIC,
            updated_at = NOW()
        WHERE id = (v_record->>'productId')::UUID AND store_id = p_store_id;

        -- Create Movement
        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
        VALUES (
            p_store_id,
            (v_record->>'productId')::UUID,
            'opname',
            (v_record->>'difference')::NUMERIC,
            NOW(),
            COALESCE(v_record->>'notes', 'Stock Opname'),
            v_session_id::TEXT
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'session_id', v_session_id);
END;
$$ LANGUAGE plpgsql;

-- 13. RPC: Process Debt Payment
CREATE OR REPLACE FUNCTION process_debt_payment(
    p_store_id UUID,
    p_customer_id TEXT,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql;

-- 21. RPC: Get Shift Summary
CREATE OR REPLACE FUNCTION get_shift_summary(
    p_store_id UUID,
    p_shift_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'transactions', COALESCE(COUNT(*), 0),
        'totalSales', COALESCE(SUM(total), 0),
        'totalCashSales', COALESCE(SUM(
            CASE 
                WHEN payment_method = 'cash' THEN total 
                WHEN payment_method = 'split' AND payment_details->>'method1' = 'cash' THEN (payment_details->>'amount1')::NUMERIC
                WHEN payment_method = 'split' AND payment_details->>'method2' = 'cash' THEN (payment_details->>'amount2')::NUMERIC
                ELSE 0 
            END
        ), 0),
        'totalNonCashSales', COALESCE(SUM(
            CASE 
                WHEN payment_method != 'cash' AND payment_method != 'split' THEN total 
                WHEN payment_method = 'split' THEN 
                    (CASE WHEN payment_details->>'method1' != 'cash' THEN (payment_details->>'amount1')::NUMERIC ELSE 0 END) +
                    (CASE WHEN payment_details->>'method2' != 'cash' THEN (payment_details->>'amount2')::NUMERIC ELSE 0 END)
                ELSE 0 
            END
        ), 0),
        'totalDiscount', COALESCE(SUM(discount), 0)
    ) INTO v_summary
    FROM transactions
    WHERE store_id = p_store_id AND shift_id = p_shift_id AND status = 'completed';

    RETURN v_summary;
END;
$$ LANGUAGE plpgsql;

-- 16. Stock Movements Table
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'in', 'out', 'sale', 'return', 'opname', 'transfer_in', 'transfer_out'
    qty NUMERIC(15, 2) NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    note TEXT,
    ref_id TEXT, -- Reference to transaction_id, opname_session_id, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Batches Table
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    initial_qty NUMERIC(15, 2) NOT NULL,
    current_qty NUMERIC(15, 2) NOT NULL,
    buy_price NUMERIC(15, 2) NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL, 
    pet_name TEXT,
    service_type TEXT,
    room_id TEXT,
    room_name TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    status TEXT DEFAULT 'pending',
    total_price NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Cash Flow Table
CREATE TABLE IF NOT EXISTS cash_flow (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    type TEXT,
    category TEXT,
    amount NUMERIC(15, 2) DEFAULT 0,
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    performed_by TEXT,
    ref_id TEXT,
    source TEXT,
    expense_group TEXT DEFAULT 'operational',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    store_name TEXT,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    user_role TEXT,
    status TEXT, -- 'success', 'failed', 'logout'
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Shopping Recommendations Table
CREATE TABLE IF NOT EXISTS shopping_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    budget NUMERIC(15, 2) DEFAULT 0,
    total_spent NUMERIC(15, 2) DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    total_weight NUMERIC(15, 2) DEFAULT 0,
    items JSONB NOT NULL,
    source TEXT -- 'ai_smart_restock', 'excel_kasir_pintar', 'excel_upload'
);

-- 19. Rental Units Table
CREATE TABLE IF NOT EXISTS rental_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    linked_product_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Rental Sessions Table
CREATE TABLE IF NOT EXISTS rental_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES rental_units(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT DEFAULT 'Guest',
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- 'active', 'completed'
    billing_mode TEXT DEFAULT 'open', -- 'open', 'fixed'
    target_duration NUMERIC(10, 2),
    target_end_time TIMESTAMPTZ,
    agreed_total NUMERIC(15, 2),
    orders JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Stock Opname Sessions Table
CREATE TABLE IF NOT EXISTS stock_opname_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    notes TEXT,
    total_products INTEGER DEFAULT 0,
    total_difference_value NUMERIC(15, 2) DEFAULT 0,
    records JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Final RLS Setup (Enable on all and apply multitenant policies)
DO $$ 
DECLARE 
    tbl RECORD;
BEGIN 
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'subscription_plans') 
    LOOP 
        EXECUTE 'ALTER TABLE ' || quote_ident(tbl.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY[
        'categories', 'products', 'transactions', 'customers', 
        'point_adjustments', 'suppliers', 'sales_targets', 'promotions',
        'purchase_orders', 'shifts', 'shift_movements', 'bookings',
        'cash_flow', 'audit_logs', 'shopping_recommendations', 
        'rental_units', 'rental_sessions', 'stock_movements', 'batches',
        'stock_opname_sessions'
    ];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables 
    LOOP 
        EXECUTE format('
            DROP POLICY IF EXISTS multitenant_%I_policy ON %I;
            CREATE POLICY multitenant_%I_policy ON %I
            FOR ALL USING (
                store_id = get_my_store_id()
            );', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;
