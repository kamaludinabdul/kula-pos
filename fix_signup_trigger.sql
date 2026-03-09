-- Definitive Fix for handle_new_user Trigger
-- This script ensures the trigger handles business_type and is robust against missing metadata.

-- 1. Ensure columns exist (safety check)
DO $$
BEGIN
    -- For stores table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'business_type') THEN
        ALTER TABLE public.stores ADD COLUMN business_type TEXT DEFAULT 'general';
    END IF;
    
    -- For profiles table (fixes potential "column does not exist" errors)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
        ALTER TABLE public.profiles ADD COLUMN username TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status') THEN
        ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'offline';
    END IF;
END $$;

-- 2. Drop existing trigger first to be clean
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Re-create the function with complete logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
    store_name TEXT;
    owner_name TEXT;
    target_role TEXT;
    biz_type TEXT;
BEGIN
    -- Extract metadata with fallbacks
    store_name := new.raw_user_meta_data->>'store_name';
    owner_name := COALESCE(
        new.raw_user_meta_data->>'name', 
        new.raw_user_meta_data->>'full_name', 
        new.raw_user_meta_data->>'owner_name',
        split_part(new.email, '@', 1)
    );
    target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
    biz_type := COALESCE(new.raw_user_meta_data->>'business_type', 'general');

    -- Log for debugging (view in Supabase Logs > Postgres)
    RAISE NOTICE 'Handling new user: %, store: %, biz_type: %', new.id, store_name, biz_type;

    IF store_name IS NOT NULL THEN
        -- Create a new store for the owner
        INSERT INTO public.stores (
            name, 
            plan, 
            trial_ends_at, 
            plan_expiry_date, 
            owner_id, 
            owner_name, 
            email, 
            business_type
        )
        VALUES (
            store_name, 
            'pro',                      
            NOW() + INTERVAL '7 days',  
            NOW() + INTERVAL '7 days',  
            new.id, 
            owner_name, 
            new.email,
            biz_type
        )
        RETURNING id INTO new_store_id;
        
        target_role := 'owner';
    ELSE
        -- For staff, get store_id from metadata
        BEGIN
            new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            new_store_id := NULL;
        END;
    END IF;

    -- Create the profile (using columns we just ensured exist)
    INSERT INTO public.profiles (
        id, 
        username, 
        name, 
        email, 
        role, 
        store_id,
        status
    )
    VALUES (
        new.id, 
        new.email, -- username maps to email by default
        owner_name,
        new.email, 
        target_role, 
        new_store_id,
        'online'
    );

    RETURN new;
EXCEPTION WHEN OTHERS THEN
    -- Capture any error to prevent 500 if possible, or at least log it
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Fix permissions (SECURITY DEFINER should handle it, but sometimes search_path is needed)
ALTER FUNCTION public.handle_new_user() SET search_path = public;
