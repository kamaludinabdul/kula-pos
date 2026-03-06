BEGIN;

DO $$
DECLARE
    v_batch RECORD;
    v_qty_to_reduce NUMERIC;
    v_movement_exists BOOLEAN;
BEGIN
    FOR v_batch IN 
        SELECT id, store_id, product_id, initial_qty, current_qty, note, created_at, updated_at
        FROM public.batches
        WHERE note LIKE '%[Pemusnahan:%' AND current_qty = 0
    LOOP
        -- Check if a stock movement already exists for this batch's write-off around the updated_at time
        -- Or just checking any 'out' movement with note containing 'Pemusnahan' for this product
        SELECT EXISTS (
            SELECT 1 FROM public.stock_movements 
            WHERE product_id = v_batch.product_id 
              AND type = 'out' 
              AND note LIKE '%Pemusnahan%'
              AND abs(EXTRACT(EPOCH FROM (date - v_batch.updated_at))) < 86400 -- within ~1 day
        ) INTO v_movement_exists;

        IF NOT v_movement_exists THEN
            -- We need to deduce the written off quantity. 
            -- If current_qty is 0, the qty written off was likely the difference between initial_qty and current_qty, 
            -- OR if it was partially sold before, we might not know exactly unless we check sales.
            -- However, the user's cash_flow entry has the exact amount. 
            -- Let's find the corresponding cash_flow entry. We know it happened around `v_batch.updated_at`.
            
            -- We extract qty from cash_flow description: "Pemusnahan: % - <qty> pcs"
            SELECT (substring(description from ' - ([0-9]+) pcs')::NUMERIC)
            INTO v_qty_to_reduce
            FROM public.cash_flow
            WHERE store_id = v_batch.store_id 
              AND expense_group = 'write_off'
              AND abs(EXTRACT(EPOCH FROM (date::timestamp - v_batch.updated_at))) < 172800 -- within 2 days just in case tz diff
            ORDER BY abs(EXTRACT(EPOCH FROM (date::timestamp - v_batch.updated_at))) ASC
            LIMIT 1;

            -- If we couldn't find it in cash_flow, we might just assume initial_qty if there were no other movements,
            -- or skip to be safe. Let's strictly use cash_flow to be accurate on financial parity.
            IF v_qty_to_reduce IS NOT NULL AND v_qty_to_reduce > 0 THEN
                
                -- 1. Insert into stock_movements
                INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note)
                VALUES (
                    v_batch.store_id, 
                    v_batch.product_id, 
                    'out', 
                    v_qty_to_reduce, 
                    v_batch.updated_at, 
                    'Pemusnahan stok kedaluwarsa/rusak (Legacy Batch: ' || substring(v_batch.id::text from 1 for 8) || ')'
                );

                -- 2. Reduce the actual product stock
                UPDATE public.products
                SET stock = stock - v_qty_to_reduce
                WHERE id = v_batch.product_id;

                RAISE NOTICE 'Fixed product % by reducing % units.', v_batch.product_id, v_qty_to_reduce;
            ELSE
                RAISE NOTICE 'Could not determine qty for batch % (Product %)', v_batch.id, v_batch.product_id;
            END IF;
            
        END IF;
    END LOOP;
END;
$$;

COMMIT;
