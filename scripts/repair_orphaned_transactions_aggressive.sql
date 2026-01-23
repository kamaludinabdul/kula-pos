-- AGGRESSIVE REPAIR SCRIPT
-- This script finds ALL orphaned transactions (shift_id IS NULL) for each store
-- and links them to the store's CURRENTLY ACTIVE SHIFT.
-- This addresses the issue where backdated transactions (from last month/year) 
-- were not picked up by the previous repair because they were "before" the shift started.

BEGIN;

DO $$
DECLARE
    r_store RECORD;
    v_active_shift_id UUID;
    v_count INT;
BEGIN
    RAISE NOTICE 'Starting aggressive repair of orphaned transactions...';

    FOR r_store IN SELECT id FROM stores LOOP
        -- 1. Find the ACTIVE shift for this store
        SELECT id INTO v_active_shift_id 
        FROM shifts 
        WHERE store_id = r_store.id 
          AND status = 'active' 
        ORDER BY start_time DESC 
        LIMIT 1;
        
        -- 2. If an active shift exists, dump all orphaned transactions into it
        IF v_active_shift_id IS NOT NULL THEN
            UPDATE transactions 
            SET shift_id = v_active_shift_id
            WHERE store_id = r_store.id 
              AND shift_id IS NULL; -- The only criteria is "has no shift"
              
            GET DIAGNOSTICS v_count = ROW_COUNT;
            
            IF v_count > 0 THEN
                RAISE NOTICE 'Store %: Linked % orphaned transactions to Active Shift %', r_store.id, v_count, v_active_shift_id;
            ELSE
                 RAISE NOTICE 'Store %: No orphaned transactions found.', r_store.id;
            END IF;
        ELSE
            RAISE NOTICE 'Store %: No active shift found. Skipping.', r_store.id;
        END IF;
    END LOOP;

    RAISE NOTICE 'Aggressive repair complete.';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
