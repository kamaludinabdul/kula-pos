-- ULTRA ROBUST handle_new_user
-- Purpose: Create Store and Profile on Auth signup without ever failing the main transaction.

-- 1. Ensure logs table exists
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id SERIAL PRIMARY KEY,
    location TEXT,
    error_message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure schema components are present
DO $$
BEGIN
    -- profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
        ALTER TABLE public.profiles ADD COLUMN username TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status') THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'offline';
    END IF;
    -- stores
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'business_type') THEN
        ALTER TABLE public.stores ADD COLUMN business_type TEXT DEFAULT 'general';
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
        v_target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
        v_biz_type := COALESCE(new.raw_user_meta_data->>'business_type', 'general');

        -- A. Handle Store Creation
        IF v_store_name IS NOT NULL THEN
            INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email, business_type)
            VALUES (
                v_store_name, 
                'pro',                      
                NOW() + INTERVAL '7 days',  
                NOW() + INTERVAL '7 days',  
                new.id, 
                v_owner_name, 
                new.email,
                v_biz_type
            )
            RETURNING id INTO new_store_id;
            
            v_target_role := 'owner';
        ELSE
            -- Try to get store_id for staff
            BEGIN
                new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
            EXCEPTION WHEN OTHERS THEN
                new_store_id := NULL;
            END;
        END IF;

        -- B. Handle Profile Creation
        -- We try to insert with many columns, but if it fails we catch it.
        BEGIN
            INSERT INTO public.profiles (id, username, name, email, role, store_id, status)
            VALUES (
                new.id, 
                new.email, 
                v_owner_name,
                new.email, 
                v_target_role, 
                new_store_id,
                'online'
            );
        EXCEPTION WHEN OTHERS THEN
            -- If the above fails (maybe 'username' or 'status' still weird), try minimalist insert
            INSERT INTO public.debug_logs (location, error_message, payload)
            VALUES ('handle_new_user_profile_failed', SQLERRM, jsonb_build_object('user_id', new.id));
            
            INSERT INTO public.profiles (id, name, email)
            VALUES (new.id, v_owner_name, new.email);
        END;

    EXCEPTION WHEN OTHERS THEN
        -- FINAL CATCH: Log the error to debug_logs.
        -- We do NOT RAISE EXCEPTION so the user is at least created in auth.users.
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

-- 5. Fix permissions
ALTER FUNCTION public.handle_new_user() SET search_path = public;
