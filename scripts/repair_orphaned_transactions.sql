-- REPAIR SCRIPT: Fix Orphaned Transactions
-- This script finds transactions that have NO shift_id (orphaned)
-- and retroactively links them to the shift that was open at the time.

BEGIN;

DO $$
DECLARE
    r_shift RECORD;
    v_updated_count INT := 0;
BEGIN
    RAISE NOTICE 'Starting repair of orphaned transactions...';

    -- Iterate through all shifts (both active and closed)
    FOR r_shift IN 
        SELECT id, store_id, start_time, end_time, status 
        FROM shifts 
        ORDER BY start_time DESC
    LOOP
        -- Update transactions that belong to this shift's time window
        -- AND currently have no shift_id
        UPDATE transactions
        SET shift_id = r_shift.id
        WHERE store_id = r_shift.store_id
          AND shift_id IS NULL
          AND date >= r_shift.start_time
          AND date <= COALESCE(r_shift.end_time, NOW());
          
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        
        IF v_updated_count > 0 THEN
            RAISE NOTICE 'Fixed % transactions for Shift % (Store %)', v_updated_count, r_shift.id, r_shift.store_id;
        END IF;
    END LOOP;

    RAISE NOTICE 'Repair complete.';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
