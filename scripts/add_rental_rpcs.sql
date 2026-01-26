
-- 1. RPC: Add Session Item (Immediate Stock Deduction)
CREATE OR REPLACE FUNCTION add_session_item(
    p_session_id UUID,
    p_store_id UUID,
    p_product_id UUID,
    p_qty NUMERIC,
    p_price NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_product_name TEXT;
    v_current_orders JSONB;
    v_new_item JSONB;
BEGIN
    -- Get Product Data
    SELECT name INTO v_product_name FROM products WHERE id = p_product_id AND store_id = p_store_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found');
    END IF;

    -- Deduct Stock
    UPDATE products 
    SET stock = stock - p_qty 
    WHERE id = p_product_id AND store_id = p_store_id;

    -- Record Movement
    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
    VALUES (p_store_id, p_product_id, 'out', p_qty, NOW(), 'Used in Service Session', p_session_id::TEXT);

    -- Prepare New Item Object (with flag stock_deducted = true)
    v_new_item := jsonb_build_object(
        'id', p_product_id,
        'name', v_product_name,
        'qty', p_qty,
        'price', p_price,
        'stock_deducted', true,
        'added_at', NOW()
    );

    -- Append to Session Orders (handle null orders)
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

-- 2. RPC: Remove Session Item (Restores Stock)
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
    -- Get Session Data
    SELECT * INTO v_session FROM rental_sessions WHERE id = p_session_id AND store_id = p_store_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Session not found');
    END IF;

    v_orders := v_session.orders;
    
    -- Check Index Validity
    IF p_item_index < 0 OR p_item_index >= jsonb_array_length(v_orders) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid item index');
    END IF;

    -- Get Item to Remove
    v_target_item := v_orders->p_item_index;
    v_product_id := (v_target_item->>'id')::UUID;
    v_qty := (v_target_item->>'qty')::NUMERIC;

    -- Restore Stock ONLY IF it was deducted (check flag)
    IF (v_target_item->>'stock_deducted')::BOOLEAN IS TRUE THEN
        UPDATE products 
        SET stock = stock + v_qty 
        WHERE id = v_product_id AND store_id = p_store_id;

        -- Record Movement
        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
        VALUES (p_store_id, v_product_id, 'in', v_qty, NOW(), 'Restored from Service Session', p_session_id::TEXT);
    END IF;

    -- Remove Item from Array (using - operator with index)
    UPDATE rental_sessions
    SET orders = v_orders - p_item_index
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 3. UPDATE: Process Sale (Skip Stock Deduction if flag exists)
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

    -- 1. Create Transaction ID
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
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        id TEXT, 
        qty NUMERIC, 
        name TEXT, 
        price NUMERIC,
        stock_deducted BOOLEAN
    )
    LOOP
        -- SKIP STOCK DEDUCTION IF ALREADY DEDUCTED (stock_deducted = true)
        IF v_item.stock_deducted IS TRUE THEN
            -- Log but do not deduct stock again
            -- Ideally we might want to link the previous movement, but for now just skip
            CONTINUE;
        END IF;

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
