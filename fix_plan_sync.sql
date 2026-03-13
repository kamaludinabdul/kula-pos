-- FIX: Sync Plan from Stores to Profiles
-- Problem: Super Admin sets plan='pro' on stores table, but the user still sees 'free'
-- because profiles.plan is never updated.
-- This script:
--   1. Adds plan + plan_expiry_date columns to profiles if missing
--   2. Syncs existing store plans to their owner's profile
--   3. Creates a trigger to auto-sync future changes

-- ============================================
-- STEP 1: Ensure profiles has plan columns
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='plan') THEN
        ALTER TABLE public.profiles ADD COLUMN plan TEXT DEFAULT 'free';
        RAISE NOTICE 'Added plan column to profiles';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='plan_expiry_date') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_expiry_date TIMESTAMPTZ;
        RAISE NOTICE 'Added plan_expiry_date column to profiles';
    END IF;
END $$;

-- ============================================
-- STEP 2: Sync ALL existing store plans → owner profiles
-- This is the immediate fix for fathulmuin@gmail.com and all others
-- ============================================
UPDATE public.profiles p
SET 
    plan = s.plan,
    plan_expiry_date = s.plan_expiry_date
FROM public.stores s
WHERE s.owner_id = p.id
  AND s.plan IS NOT NULL
  AND (p.plan IS DISTINCT FROM s.plan OR p.plan_expiry_date IS DISTINCT FROM s.plan_expiry_date);

-- ============================================
-- STEP 2.5: FIX CROSS-STORE DATA LEAK
-- Problem: Some owners have store_id pointing to the WRONG store.
-- This causes them to see staff from another store.
-- Fix: Set owner's profile.store_id to their OWN store.
-- ============================================
UPDATE public.profiles p
SET store_id = s.id
FROM public.stores s
WHERE s.owner_id = p.id
  AND (p.store_id IS NULL OR p.store_id != s.id)
  AND p.role = 'owner';

-- Diagnostic: Show any remaining mismatches
DO $$
DECLARE
    mismatch_count INT;
BEGIN
    SELECT COUNT(*) INTO mismatch_count
    FROM profiles p
    JOIN stores s ON s.owner_id = p.id
    WHERE p.store_id != s.id AND p.role = 'owner';
    
    IF mismatch_count > 0 THEN
        RAISE WARNING 'ALERT: % owners still have mismatched store_id!', mismatch_count;
    ELSE
        RAISE NOTICE 'OK: All owner store_ids are correctly assigned.';
    END IF;
END $$;

-- ============================================
-- STEP 3: Auto-sync triggers (stores → profiles)
-- ============================================

-- 3A. Sync plan changes
CREATE OR REPLACE FUNCTION public.sync_store_plan_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.plan IS DISTINCT FROM NEW.plan) OR (OLD.plan_expiry_date IS DISTINCT FROM NEW.plan_expiry_date) THEN
        UPDATE public.profiles
        SET 
            plan = NEW.plan,
            plan_expiry_date = NEW.plan_expiry_date
        WHERE id = NEW.owner_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_store_plan_updated ON public.stores;
CREATE TRIGGER on_store_plan_updated
    AFTER UPDATE OF plan, plan_expiry_date ON public.stores
    FOR EACH ROW EXECUTE FUNCTION public.sync_store_plan_to_profile();

-- 3B. Sync store_id + role on store creation or owner change
-- THIS PREVENTS THE CROSS-STORE DATA LEAK FROM EVER HAPPENING AGAIN
CREATE OR REPLACE FUNCTION public.sync_store_owner_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new store is created, set the owner's store_id and role
    IF TG_OP = 'INSERT' AND NEW.owner_id IS NOT NULL THEN
        UPDATE public.profiles SET 
            store_id = NEW.id,
            role = 'owner'
        WHERE id = NEW.owner_id
          AND (store_id IS NULL OR store_id != NEW.id);
    END IF;

    -- When owner_id changes on an existing store
    IF TG_OP = 'UPDATE' AND OLD.owner_id IS DISTINCT FROM NEW.owner_id AND NEW.owner_id IS NOT NULL THEN
        -- Update new owner's profile
        UPDATE public.profiles SET 
            store_id = NEW.id,
            role = 'owner'
        WHERE id = NEW.owner_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_store_owner_synced ON public.stores;
CREATE TRIGGER on_store_owner_synced
    AFTER INSERT OR UPDATE OF owner_id ON public.stores
    FOR EACH ROW EXECUTE FUNCTION public.sync_store_owner_to_profile();

-- ============================================
-- STEP 4: Also update handle_new_user to set profiles.plan on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
    v_store_name TEXT;
    v_owner_name TEXT;
    v_target_role TEXT;
    v_biz_type TEXT;
BEGIN
    BEGIN
        v_store_name := new.raw_user_meta_data->>'store_name';
        v_owner_name := COALESCE(
            new.raw_user_meta_data->>'name', 
            new.raw_user_meta_data->>'full_name', 
            new.raw_user_meta_data->>'owner_name',
            split_part(new.email, '@', 1)
        );
        v_target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
        v_biz_type := COALESCE(new.raw_user_meta_data->>'business_type', 'general');

        -- A. Create Profile FIRST
        BEGIN
            INSERT INTO public.profiles (id, username, name, email, role, plan, status)
            VALUES (
                new.id, new.email, v_owner_name, new.email, 
                v_target_role, 
                CASE WHEN v_store_name IS NOT NULL AND v_store_name <> '' THEN 'pro' ELSE 'free' END,
                'online'
            );
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.debug_logs (location, error_message, payload)
            VALUES ('handle_new_user_profile_failed', SQLERRM, jsonb_build_object('user_id', new.id, 'email', new.email));
            INSERT INTO public.profiles (id, name, email)
            VALUES (new.id, v_owner_name, new.email)
            ON CONFLICT (id) DO NOTHING;
        END;

        -- B. Create Store
        IF v_store_name IS NOT NULL AND v_store_name <> '' THEN
            BEGIN
                INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email, business_type)
                VALUES (
                    v_store_name, 'pro', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days',
                    new.id, v_owner_name, new.email, v_biz_type
                )
                RETURNING id INTO new_store_id;
                
                -- C. Update profile with store_id, role=owner, plan=pro, plan_expiry
                UPDATE public.profiles SET 
                    store_id = new_store_id,
                    role = 'owner',
                    plan = 'pro',
                    plan_expiry_date = NOW() + INTERVAL '7 days'
                WHERE id = new.id;
            EXCEPTION WHEN OTHERS THEN
                INSERT INTO public.debug_logs (location, error_message, payload)
                VALUES ('handle_new_user_store_failed', SQLERRM, jsonb_build_object('user_id', new.id, 'store_name', v_store_name));
            END;
        ELSE
            BEGIN
                new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
                IF new_store_id IS NOT NULL THEN
                    UPDATE public.profiles SET store_id = new_store_id WHERE id = new.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (location, error_message, payload)
        VALUES ('handle_new_user_global_failure', SQLERRM, row_to_json(new)::jsonb);
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.sync_store_plan_to_profile() SET search_path = public;

-- ============================================
-- VERIFICATION: Check all owners
-- ============================================
SELECT 
    p.email, 
    p.role, 
    p.plan as profile_plan, 
    p.store_id as profile_store_id,
    s.id as actual_store_id,
    s.name as store_name, 
    s.plan as store_plan,
    CASE WHEN p.store_id = s.id THEN '✅ OK' ELSE '❌ MISMATCH' END as store_id_check
FROM profiles p
LEFT JOIN stores s ON s.owner_id = p.id
WHERE p.role = 'owner'
ORDER BY p.email;
