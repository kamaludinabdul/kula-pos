-- MASTER: check_staff_conflict
-- Purpose: Check if an email is already registered to another store
-- Source: scripts/create_check_conflict_rpc.sql

CREATE OR REPLACE FUNCTION public.check_staff_conflict(
    p_email TEXT,
    p_target_store_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_store_name TEXT;
BEGIN
    -- 1. Check if profile exists
    SELECT * INTO v_profile FROM profiles WHERE email = p_email LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'available');
    END IF;

    -- 2. Check Store ID
    IF v_profile.store_id = p_target_store_id THEN
        RETURN jsonb_build_object(
            'status', 'same_store',
            'current_role', v_profile.role,
            'id', v_profile.id
        );
    ELSE
        -- Fetch store name for friendly error message
        SELECT name INTO v_store_name FROM stores WHERE id = v_profile.store_id;
        
        -- If store doesn't exist (Orphan Profile) or store_id is NULL, allow claiming it
        IF NOT FOUND OR v_profile.store_id IS NULL THEN
            RETURN jsonb_build_object('status', 'available');
        END IF;

        RETURN jsonb_build_object(
            'status', 'conflict', 
            'current_store_name', COALESCE(v_store_name, 'Unknown Store')
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
