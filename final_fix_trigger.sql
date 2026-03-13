-- SELF-HEALING REGISTRATION TRIGGER
-- This version is bulletproof:
-- 1. Creates Profile BEFORE Store (fixes Foreign Key error)
-- 2. Safely handles missing debug_logs table
-- 3. High-integrity defaults for required columns

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
    v_store_name TEXT;
    v_owner_name TEXT;
    v_target_role TEXT;
    v_biz_type TEXT;
    v_error_msg TEXT;
BEGIN
    -- Extract meta data
    v_store_name := new.raw_user_meta_data->>'store_name';
    v_owner_name := COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.email);
    v_target_role := COALESCE(new.raw_user_meta_data->>'role', 'owner');
    v_biz_type := COALESCE(new.raw_user_meta_data->>'business_type', 'general');

    BEGIN
        -- STEP 1: Create Profile (Must be first for FK reasons)
        INSERT INTO public.profiles (id, username, name, email, role, status)
        VALUES (new.id, new.email, v_owner_name, new.email, v_target_role, 'online')
        ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name,
            role = EXCLUDED.role;

        -- STEP 2: Create Store if applicable
        IF v_store_name IS NOT NULL THEN
            INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email, business_type)
            VALUES (
                v_store_name, 
                'pro',                      
                NOW() + INTERVAL '30 days', -- Give 30 days trial for first store
                NOW() + INTERVAL '30 days',  
                new.id, 
                v_owner_name, 
                new.email,
                v_biz_type
            )
            RETURNING id INTO new_store_id;
            
            -- STEP 3: Link Store back to Profile
            UPDATE public.profiles SET store_id = new_store_id WHERE id = new.id;
        ELSE
            -- Handle staff registration
            BEGIN
                new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
                IF new_store_id IS NOT NULL THEN
                    UPDATE public.profiles SET store_id = new_store_id WHERE id = new.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN NULL;
            END;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- Log failure safely
        v_error_msg := SQLERRM;
        BEGIN
            INSERT INTO public.debug_logs (location, error_message, payload)
            VALUES ('handle_new_user_failure', v_error_msg, row_to_json(new)::jsonb);
        EXCEPTION WHEN OTHERS THEN 
            -- If debug_logs table is missing, don't crash the whole signup!
            RAISE WARNING 'handle_new_user failed and debug_logs missing: %', v_error_msg;
        END;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
