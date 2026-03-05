-- =====================================================================================
-- FIX: Handle New User Registration (Profile Creation before Store to satisfy FK)
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
    store_name TEXT;
    owner_name TEXT;
    target_role TEXT;
BEGIN
    -- 1. Extract metadata
    store_name := new.raw_user_meta_data->>'store_name';
    owner_name := COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'owner_name');
    target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');

    -- 2. CREATE PROFILE FIRST
    -- We must create the profile first because the stores table has a foreign key:
    -- 'owner_id' REFERENCES 'profiles(id)'
    INSERT INTO public.profiles (id, name, email, role, store_id)
    VALUES (
        new.id, 
        COALESCE(owner_name, new.email),
        new.email, 
        (CASE WHEN store_name IS NOT NULL AND (new.raw_user_meta_data->>'is_staff_registration') IS DISTINCT FROM 'true' THEN 'owner' ELSE target_role END), 
        NULL -- We will update this later if creating a new store
    );

    -- 3. If store_name is present AND NOT staff registration, create a store
    IF store_name IS NOT NULL AND (new.raw_user_meta_data->>'is_staff_registration') IS DISTINCT FROM 'true' THEN
        INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email)
        VALUES (
            store_name, 
            'pro',                      -- Set initial plan to PRO
            NOW() + INTERVAL '7 days',  -- 7-Day Trial
            NOW() + INTERVAL '7 days',  -- Expiry same as trial
            new.id,                     -- Now safe, profile exists
            owner_name, 
            new.email
        )
        RETURNING id INTO new_store_id;
        
        -- Update the profile with the newly created store_id
        UPDATE public.profiles SET store_id = new_store_id WHERE id = new.id;
    ELSE
        -- Staff registration or generic signup without new store creation
        BEGIN
            new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
            IF new_store_id IS NOT NULL THEN
                UPDATE public.profiles SET store_id = new_store_id WHERE id = new.id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            new_store_id := NULL;
        END;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
