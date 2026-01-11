-- FIX: get_sales_person_ranking RPC and process_sale enhancement
-- Resolves "column t.sales_person_id does not exist" and ensures cashier tracking.

-- 1. Correct the get_sales_person_ranking RPC
-- Aliases cashier_id to sales_person_id to match frontend expectations.
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.cashier_id as sales_person_id,
        COALESCE(p.name, t.cashier, 'Unknown') as sales_person_name,
        SUM(t.total) as total_sales,
        SUM(t.discount) as total_discount,
        COUNT(t.id) as transaction_count
    FROM transactions t
    LEFT JOIN profiles p ON t.cashier_id = p.id
    WHERE t.store_id = p_store_id
      AND t.date >= p_start_date
      AND t.date <= p_end_date
      AND t.status = 'completed'
    GROUP BY t.cashier_id, p.name, t.cashier;
END;
$$;

-- 2. Enhance process_sale to automate cashier recording and keep customer mapping
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
    v_cashier_id UUID := auth.uid();
    v_cashier_name TEXT := NULL;
BEGIN
    -- Calculate subtotal if not provided
    v_subtotal := COALESCE(p_subtotal, p_total + p_discount);

    -- Fetch customer name for denormalization
    IF p_customer_id IS NOT NULL THEN
        SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND store_id = p_store_id;
    END IF;

    -- Fetch current cashier name
    IF v_cashier_id IS NOT NULL THEN
        SELECT name INTO v_cashier_name FROM profiles WHERE id = v_cashier_id;
    END IF;

    -- 1. Create Transaction ID (YYMMDDHH24MISS + random)
    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- 2. Insert Transaction Record
    INSERT INTO transactions (
        id, store_id, customer_id, customer_name, cashier_id, cashier, 
        total, discount, subtotal, payment_method, 
        amount_paid, "change", "type", rental_session_id, payment_details, 
        items, date, status, shift_id, points_earned
    )
    VALUES (
        v_new_transaction_id, p_store_id, p_customer_id, v_customer_name, v_cashier_id, v_cashier_name, 
        p_total, p_discount, v_subtotal, p_payment_method, 
        p_amount_paid, p_change, p_type, p_rental_session_id, p_payment_details, 
        p_items, p_date, 'completed', p_shift_id, p_points_earned
    );

    -- 3. Process each item (Stock & Sold Stats)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, qty NUMERIC, name TEXT, price NUMERIC)
    LOOP
        -- Only update stock if ID is a valid UUID
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
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

    -- 4. Update Customer Points & Total Spent
    IF p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET total_spent = total_spent + p_total,
            loyalty_points = loyalty_points + p_points_earned,
            total_lifetime_points = total_lifetime_points + p_points_earned,
            debt = CASE WHEN p_payment_method = 'debt' THEN debt + p_total ELSE debt END
        WHERE id = p_customer_id AND store_id = p_store_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id, 'customer_name', v_customer_name);
END;
$$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
