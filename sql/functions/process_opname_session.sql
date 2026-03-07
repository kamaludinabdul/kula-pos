-- MASTER: process_opname_session
-- Purpose: Save stock opname records, update product stock, and synchronize batches (FIFO)
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.process_opname_session(
    p_store_id UUID,
    p_notes TEXT,
    p_records JSONB -- [{productId, physicalStock, systemStock, difference, differenceValue, notes, buyPrice}]
) RETURNS JSONB AS $$
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
