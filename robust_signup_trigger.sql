-- ULTRA ROBUST handle_new_user (v3.0)
-- Purpose: Create Store and Profile on Auth signup without ever failing the main transaction.
-- Includes: Plan sync to profiles, missing column safety, error logging.

-- 1. Ensure logs table exists
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id SERIAL PRIMARY KEY,
    location TEXT,
    error_message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure schema components are present (MIGRATION BLOCK)
DO $$
BEGIN
    -- profiles table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
        ALTER TABLE public.profiles ADD COLUMN username TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status') THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'offline';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'plan') THEN
        ALTER TABLE public.profiles ADD COLUMN plan TEXT DEFAULT 'free';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'plan_expiry_date') THEN
        ALTER TABLE public.profiles ADD COLUMN plan_expiry_date TIMESTAMPTZ;
    END IF;
    
    -- stores table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'business_type') THEN
        ALTER TABLE public.stores ADD COLUMN business_type TEXT DEFAULT 'general';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'plan_expiry_date') THEN
        ALTER TABLE public.stores ADD COLUMN plan_expiry_date TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'plan') THEN
        ALTER TABLE public.stores ADD COLUMN plan TEXT DEFAULT 'free';
    END IF;
END $$;

-- 3. The Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
    v_store_name TEXT;
    v_owner_name TEXT;
    v_target_role TEXT;
    v_biz_type TEXT;
BEGIN
    -- WRAP EVERYTHING IN A PROTECTIVE BLOCK
    BEGIN
        v_store_name := new.raw_user_meta_data->>'store_name';
        v_owner_name := COALESCE(
            new.raw_user_meta_data->>'name', 
            new.raw_user_meta_data->>'full_name', 
            new.raw_user_meta_data->>'owner_name',
            split_part(new.email, '@', 1)
        );
        -- Default role is staff unless specified
        v_target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
        v_biz_type := COALESCE(new.raw_user_meta_data->>'business_type', 'general');

        -- A. Handle Profile Creation FIRST
        BEGIN
            INSERT INTO public.profiles (id, username, name, email, role, plan, status)
            VALUES (
                new.id, 
                new.email, 
                v_owner_name,
                new.email, 
                v_target_role,
                CASE WHEN v_store_name IS NOT NULL AND v_store_name <> '' THEN 'pro' ELSE 'free' END,
                'online'
            );
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO public.debug_logs (location, error_message, payload)
            VALUES ('handle_new_user_profile_failed', SQLERRM, jsonb_build_object('user_id', new.id, 'email', new.email));
            
            -- Fallback insert if primary fails
            INSERT INTO public.profiles (id, name, email)
            VALUES (new.id, v_owner_name, new.email)
            ON CONFLICT (id) DO NOTHING;
        END;

        -- B. Handle Store Creation
        IF v_store_name IS NOT NULL AND v_store_name <> '' THEN
            BEGIN
                INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email, business_type)
                VALUES (
                    v_store_name, 
                    'pro',                      -- 7-DAY PRO TRIAL
                    NOW() + INTERVAL '7 days',  
                    NOW() + INTERVAL '7 days',  
                    new.id, 
                    v_owner_name, 
                    new.email,
                    v_biz_type
                )
                RETURNING id INTO new_store_id;
                
                -- C. Update profile with the new store_id AND set role to owner + plan to pro
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
            -- Try to get store_id for staff invitations
            BEGIN
                new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
                IF new_store_id IS NOT NULL THEN
                    UPDATE public.profiles SET store_id = new_store_id WHERE id = new.id;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                NULL; -- Ignore malformed UUIDs
            END;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- FINAL CATCH: Log the error to debug_logs.
        INSERT INTO public.debug_logs (location, error_message, payload)
        VALUES ('handle_new_user_global_failure', SQLERRM, row_to_json(new)::jsonb);
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Auto-sync trigger: stores.plan → profiles.plan
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

-- 6. Fix permissions & path
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.sync_store_plan_to_profile() SET search_path = public;
