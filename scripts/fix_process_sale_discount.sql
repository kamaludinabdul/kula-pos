-- Fix Process Sale to Handle Item-Level Discounts
-- ===============================================

-- 1. Drop existing function signature to allow replacement if types changed (though here they are same, safer to replace)
-- note: process_sale has many parameters, using CREATE OR REPLACE is usually sufficient if signature matches.

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
        discount NUMERIC, -- Added discount extraction
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
                -- FIX: Calculate revenue based on actual selling price (Price - Discount)
                revenue = revenue + (v_item.qty * (v_item.price - COALESCE(v_item.discount, 0)))
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

-- Refresh cache
NOTIFY pgrst, 'reload schema';
