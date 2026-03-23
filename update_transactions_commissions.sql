-- Migration to support doctor commissions in transactions and link to medical records

-- 1. Create transaction_items table for better reporting
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id TEXT REFERENCES transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    name TEXT,
    qty NUMERIC,
    price NUMERIC,
    buy_price NUMERIC,
    discount NUMERIC,
    doctor_id UUID REFERENCES profiles(id),
    doctor_commission_type TEXT,
    doctor_commission_value NUMERIC,
    doctor_commission_amount NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add columns to transactions for medical context
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES medical_records(id),
ADD COLUMN IF NOT EXISTS patient_name TEXT;

-- 3. Update process_sale RPC to handle commissions and medical records
-- Drop first to handle signature changes if necessary
DROP FUNCTION IF EXISTS public.process_sale(UUID, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, UUID, JSONB, NUMERIC, UUID, TIMESTAMPTZ, NUMERIC, UUID, TEXT);

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
    p_cashier_name TEXT DEFAULT NULL,
    p_patient_name TEXT DEFAULT NULL,
    p_medical_record_id UUID DEFAULT NULL
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

    -- 2. Insert Transaction Record
    INSERT INTO transactions (
        id, store_id, customer_id, customer_name, total, discount, subtotal, payment_method, 
        amount_paid, "change", "type", rental_session_id, payment_details, 
        items, date, status, shift_id, points_earned,
        cashier_id, cashier,
        medical_record_id, patient_name
    )
    VALUES (
        v_new_transaction_id, p_store_id, p_customer_id, v_customer_name, p_total, p_discount, v_subtotal, p_payment_method, 
        p_amount_paid, p_change, p_type, p_rental_session_id, p_payment_details, 
        p_items, p_date, 'completed', p_shift_id, p_points_earned,
        p_cashier_id, p_cashier_name,
        p_medical_record_id, p_patient_name
    );

    -- 3. Process each item (Stock & Sold Stats & Commission)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        id TEXT, 
        qty NUMERIC, 
        name TEXT, 
        price NUMERIC,
        buy_price NUMERIC,
        discount NUMERIC,
        stock_deducted BOOLEAN,
        doctor_id UUID,
        doctor_commission_type TEXT,
        doctor_commission_value NUMERIC,
        doctor_commission_amount NUMERIC
    )
    LOOP
        -- Insert into transaction_items for better reporting
        INSERT INTO transaction_items (
            transaction_id, product_id, name, qty, price, buy_price, discount,
            doctor_id, doctor_commission_type, doctor_commission_value, doctor_commission_amount
        )
        VALUES (
            v_new_transaction_id, 
            CASE WHEN v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN v_item.id::UUID ELSE NULL END,
            v_item.name, v_item.qty, v_item.price, COALESCE(v_item.buy_price, 0), COALESCE(v_item.discount, 0),
            v_item.doctor_id, v_item.doctor_commission_type, v_item.doctor_commission_value, v_item.doctor_commission_amount
        );

        -- MERGED LOGIC: Check stock_deducted flag
        IF COALESCE(v_item.stock_deducted, false) IS TRUE THEN
            CONTINUE;
        END IF;

        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            -- Stock validation
            SELECT stock, 
                   COALESCE((SELECT is_unlimited FROM products WHERE id = v_item.id::UUID), false),
                   COALESCE((SELECT type FROM products WHERE id = v_item.id::UUID), 'product')
            INTO v_current_stock, v_is_unlimited, v_prod_type
            FROM products 
            WHERE id = v_item.id::UUID AND store_id = p_store_id FOR UPDATE;

            IF FOUND THEN
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
        END IF;
    END LOOP;

    -- 4. Update Customer Points & History
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

    -- 5. Mark Medical Record as Paid
    IF p_medical_record_id IS NOT NULL THEN
        UPDATE medical_records SET is_paid_pos = true WHERE id = p_medical_record_id;
    END IF;

    -- 6. Update Shift Statistics
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
$$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
