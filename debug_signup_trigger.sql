-- 1. Create a debug table to capture trigger errors
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id SERIAL PRIMARY KEY,
    location TEXT,
    error_message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update handle_new_user with Error Handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
    store_name TEXT;
    owner_name TEXT;
    target_role TEXT;
    biz_type TEXT;
BEGIN
    BEGIN
        -- Extract data
        store_name := new.raw_user_meta_data->>'store_name';
        owner_name := COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'owner_name');
        target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
        biz_type := COALESCE(new.raw_user_meta_data->>'business_type', 'general');

        IF store_name IS NOT NULL THEN
            -- Create store
            INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email, business_type)
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
            BEGIN
                new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
            EXCEPTION WHEN OTHERS THEN
                new_store_id := NULL;
            END;
        END IF;

        -- Create profile
        -- NOTE: We use COALESCE for name and ensure we don't fail if some columns are missing
        -- We handle potential schema differences by using columns we know exist in supabase_schema.sql
        INSERT INTO public.profiles (id, name, email, role, store_id)
        VALUES (
            new.id, 
            COALESCE(owner_name, new.email),
            new.email, 
            target_role, 
            new_store_id 
        );

        RETURN new;

    EXCEPTION WHEN OTHERS THEN
        -- LOG THE ERROR and RETURN NEW anyway to prevent 500 if possible
        -- (Returning NEW here might still allow login, but without profile)
        INSERT INTO public.debug_logs (location, error_message, payload)
        VALUES ('handle_new_user', SQLERRM, row_to_json(new)::jsonb);
        
        -- We still want to see the error in the 500 response if it's critical,
        -- but for debugging we can choose to swallow it or let it propagate.
        -- RAISING EXCEPTION here will result in 500 with the ERROR MESSAGE in the body.
        RAISE EXCEPTION 'TRAPPED_ERROR: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Verify columns for profiles
-- (Just in case 'username' was the culprit and it's actually NOT there)
-- The profiles schema in supabase_schema.sql does NOT have username, 
-- but several migration files added it or used it. 
-- Let's make it safe.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'username') THEN
        ALTER TABLE public.profiles ADD COLUMN username TEXT;
    END IF;
END $$;
