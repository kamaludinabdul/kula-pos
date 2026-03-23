-- FIX SHIFT DIFFERENCES AND DISCOUNT DOUBLE COUNTING
-- 1. UPDATE process_sale TO HANDLE TOTAL_DISCOUNT CORRECTLY
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
    p_prescription_number TEXT DEFAULT NULL,
    p_tuslah_fee NUMERIC DEFAULT 0,
    p_medical_record_id UUID DEFAULT NULL,
    p_stamp_updates JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_transaction_id TEXT;
    v_item RECORD;
    v_subtotal NUMERIC;
    v_customer_name TEXT := NULL;
BEGIN
    -- Calculate subtotal if not provided
    v_subtotal := COALESCE(p_subtotal, p_total + p_discount);

    -- Fetch customer name
    IF p_customer_id IS NOT NULL THEN
        SELECT name INTO v_customer_name FROM public.customers WHERE id = p_customer_id AND store_id = p_store_id;
    END IF;

    -- 1. Create Transaction ID
    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- 2. Insert Transaction Record
    INSERT INTO public.transactions (
        id, store_id, customer_id, customer_name, total, discount, subtotal, payment_method, 
        amount_paid, "change", "type", rental_session_id, payment_details, 
        items, date, status, shift_id, points_earned, cashier, cashier_id,
        patient_name, prescription_number, tuslah_fee, medical_record_id
    )
    VALUES (
        v_new_transaction_id, p_store_id, p_customer_id, v_customer_name, p_total, p_discount, v_subtotal, p_payment_method, 
        p_amount_paid, p_change, p_type, p_rental_session_id, p_payment_details, 
        p_items, p_date, 'completed', p_shift_id, p_points_earned, p_cashier_name, p_cashier_id,
        p_patient_name, p_prescription_number, p_tuslah_fee, p_medical_record_id
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
        IF COALESCE(v_item.stock_deducted, false) IS TRUE THEN
            CONTINUE;
        END IF;

        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            UPDATE public.products 
            SET stock = stock - v_item.qty,
                sold = sold + v_item.qty,
                revenue = revenue + (v_item.qty * v_item.price),
                updated_at = NOW()
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'sale', -v_item.qty, p_date, 'Penjualan #' || right(v_new_transaction_id, 6), v_new_transaction_id);
        END IF;
    END LOOP;

    -- 4. Update Customer Data
    IF p_customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET total_spent = total_spent + p_total,
            loyalty_points = loyalty_points + p_points_earned,
            total_lifetime_points = total_lifetime_points + p_points_earned,
            debt = CASE WHEN p_payment_method = 'debt' THEN debt + p_total ELSE debt END,
            updated_at = NOW()
        WHERE id = p_customer_id AND store_id = p_store_id;

        IF p_points_earned > 0 THEN
            INSERT INTO public.loyalty_history (store_id, customer_id, points, description, transaction_id, date)
            VALUES (p_store_id, p_customer_id, p_points_earned, 'Penjualan #' || v_new_transaction_id, v_new_transaction_id, p_date);
        END IF;
    END IF;

    -- 5. UPDATE SHIFT TOTALS (SINGLE SOURCE OF TRUTH FOR REAL-TIME VIEW)
    IF p_shift_id IS NOT NULL THEN
        UPDATE public.shifts SET 
            total_sales = COALESCE(total_sales, 0) + p_total,
            total_discount = COALESCE(total_discount, 0) + p_discount,
            total_cash_sales = CASE WHEN p_payment_method = 'cash' THEN COALESCE(total_cash_sales, 0) + p_total ELSE total_cash_sales END,
            total_non_cash_sales = CASE WHEN p_payment_method != 'cash' THEN COALESCE(total_non_cash_sales, 0) + p_total ELSE total_non_cash_sales END,
            updated_at = NOW()
        WHERE id = p_shift_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id, 'customer_name', v_customer_name);
END;
$$;


-- 2. RECONCILE DATA: RECALCULATE EXPECTED CASH AND DIFFERENCES
-- Source of Truth: status = 'completed' transactions
UPDATE public.shifts s
SET 
    total_sales = COALESCE(tx.calc_total_sales, 0),
    total_cash_sales = COALESCE(tx.calc_cash_sales, 0),
    total_non_cash_sales = COALESCE(tx.calc_non_cash_sales, 0),
    total_discount = COALESCE(tx.calc_total_discount, 0),
    
    -- Recalculate Expectations
    expected_cash = COALESCE(initial_cash, 0) + COALESCE(tx.calc_cash_sales, 0) + COALESCE(total_cash_in, 0) - COALESCE(total_cash_out, 0),
    expected_non_cash = COALESCE(tx.calc_non_cash_sales, 0),
    
    -- Recalculate Differences ONLY IF IT IS CLOSED
    cash_difference = CASE WHEN status = 'closed' THEN COALESCE(final_cash, 0) - (COALESCE(initial_cash, 0) + COALESCE(tx.calc_cash_sales, 0) + COALESCE(total_cash_in, 0) - COALESCE(total_cash_out, 0)) ELSE cash_difference END,
    non_cash_difference = CASE WHEN status = 'closed' THEN COALESCE(final_non_cash, 0) - COALESCE(tx.calc_non_cash_sales, 0) ELSE non_cash_difference END
FROM (
    SELECT 
        shift_id,
        SUM(total) as calc_total_sales,
        SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) as calc_cash_sales,
        SUM(CASE WHEN payment_method != 'cash' THEN total ELSE 0 END) as calc_non_cash_sales,
        SUM(discount) as calc_total_discount
    FROM public.transactions
    WHERE status = 'completed' AND shift_id IS NOT NULL
    GROUP BY shift_id
) tx
WHERE s.id = tx.shift_id;

-- Ensure shifts with no transactions are reset properly
UPDATE public.shifts 
SET 
    total_sales = 0, 
    total_cash_sales = 0, 
    total_non_cash_sales = 0, 
    total_discount = 0,
    expected_cash = COALESCE(initial_cash, 0) + COALESCE(total_cash_in, 0) - COALESCE(total_cash_out, 0),
    expected_non_cash = 0,
    cash_difference = CASE WHEN status = 'closed' THEN COALESCE(final_cash, 0) - (COALESCE(initial_cash, 0) + COALESCE(total_cash_in, 0) - COALESCE(total_cash_out, 0)) ELSE cash_difference END,
    non_cash_difference = CASE WHEN status = 'closed' THEN COALESCE(final_non_cash, 0) ELSE non_cash_difference END
WHERE id NOT IN (SELECT DISTINCT shift_id FROM public.transactions WHERE shift_id IS NOT NULL AND status = 'completed');
