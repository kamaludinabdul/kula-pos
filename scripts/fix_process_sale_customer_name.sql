-- Fix: Restore customer_name in process_sale RPC
-- =================================================
-- The fix_process_sale_cashier.sql update accidentally removed customer_name
-- from the INSERT statement, causing all new transactions to have NULL customer_name.
-- This script also backfills existing transactions that are missing customer_name.

-- Step 1: Backfill existing transactions with missing customer_name
UPDATE transactions t
SET customer_name = c.name
FROM customers c
WHERE t.customer_id = c.id
  AND t.customer_id IS NOT NULL
  AND (t.customer_name IS NULL OR t.customer_name = '');

-- Step 2: Fix the process_sale RPC to include customer_name again
DROP FUNCTION IF EXISTS public.process_sale(UUID, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, UUID, JSONB, NUMERIC, UUID, TIMESTAMPTZ, NUMERIC, UUID, TEXT);

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
    p_subtotal NUMERIC DEFAULT NULL,
    p_cashier_id UUID DEFAULT NULL,
    p_cashier_name TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_transaction_id TEXT;
    v_item RECORD;
    v_new_transaction_id TEXT;
    v_subtotal NUMERIC;
    v_current_stock NUMERIC;
    v_is_unlimited BOOLEAN;
    v_prod_type TEXT;
    v_is_authorized BOOLEAN;
    v_customer_name TEXT := NULL;
BEGIN
    -- 0. Security Check
    SELECT EXISTS (
        SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
        UNION
        SELECT 1 FROM profiles WHERE id = auth.uid() AND store_id = p_store_id
        UNION
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not have access to manage sales for this store.');
    END IF;

    -- Calculate subtotal if not provided
    v_subtotal := COALESCE(p_subtotal, p_total + p_discount);

    -- Fetch customer name for denormalization
    IF p_customer_id IS NOT NULL THEN
        SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND store_id = p_store_id;
    END IF;

    -- 1. Create Transaction ID
    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- 2. Insert Transaction Record (with customer_name restored)
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

    -- 3. Process each item
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, qty NUMERIC, name TEXT, price NUMERIC, discount NUMERIC, stock_deducted BOOLEAN)
    LOOP
        -- Skip items with stock already deducted (from Rental/Service items)
        IF v_item.stock_deducted IS TRUE THEN
            CONTINUE;
        END IF;

        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            
            SELECT stock, 
                   COALESCE((SELECT is_unlimited FROM products WHERE id = v_item.id::UUID), false),
                   COALESCE((SELECT type FROM products WHERE id = v_item.id::UUID), 'product')
            INTO v_current_stock, v_is_unlimited, v_prod_type
            FROM products 
            WHERE id = v_item.id::UUID AND store_id = p_store_id FOR UPDATE;

            IF NOT FOUND THEN
                 RAISE EXCEPTION 'Produk tidak ditemukan: %', v_item.name;
            END IF;

            IF v_is_unlimited = false 
               AND v_prod_type != 'service' 
               AND v_current_stock < v_item.qty THEN
                    RAISE EXCEPTION 'Stok tidak cukup untuk produk: % (Sisa: %, Diminta: %)', v_item.name, v_current_stock, v_item.qty;
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

    -- 4. Update Customer Data
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
    
    -- 5. Update Shift Statistics if shift_id is provided
    IF p_shift_id IS NOT NULL THEN
        UPDATE shifts
        SET 
            total_sales = COALESCE(total_sales, 0) + p_total,
            total_discount = COALESCE(total_discount, 0) + p_discount,
            total_cash_sales = CASE 
                WHEN p_payment_method = 'cash' THEN COALESCE(total_cash_sales, 0) + p_total 
                ELSE COALESCE(total_cash_sales, 0) 
            END,
            total_non_cash_sales = CASE 
                WHEN p_payment_method != 'cash' THEN COALESCE(total_non_cash_sales, 0) + p_total 
                ELSE COALESCE(total_non_cash_sales, 0) 
            END
        WHERE id = p_shift_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id, 'customer_name', v_customer_name);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
