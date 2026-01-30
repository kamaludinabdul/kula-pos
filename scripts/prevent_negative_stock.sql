-- First, ensure the is_unlimited column exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_unlimited') THEN 
        ALTER TABLE products ADD COLUMN is_unlimited BOOLEAN DEFAULT FALSE; 
    END IF; 
END $$;

-- Update process_sale with stock validation
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
    v_current_stock NUMERIC;
    v_is_unlimited BOOLEAN;
    v_prod_type TEXT;
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
            
            -- Validation: Check Stock Availability
            SELECT stock, COALESCE(is_unlimited, false), COALESCE(type, 'product')
            INTO v_current_stock, v_is_unlimited, v_prod_type
            FROM products 
            WHERE id = v_item.id::UUID AND store_id = p_store_id FOR UPDATE; -- Use FOR UPDATE to lock row

            IF NOT FOUND THEN
                 RAISE EXCEPTION 'Produk tidak ditemukan: %', v_item.name;
            END IF;

            -- Logic: If NOT unlimited AND NOT service AND Stock < Qty -> Error
            IF v_is_unlimited = false 
               AND v_prod_type != 'service' 
               AND v_current_stock < v_item.qty THEN
                    RAISE EXCEPTION 'Stok tidak cukup untuk produk: % (Sisa: %, Diminta: %)', v_item.name, v_current_stock, v_item.qty;
            END IF;

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
