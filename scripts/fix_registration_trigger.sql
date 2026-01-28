-- =====================================================================================
-- FIX: Handle New User Registration (Profile & Store Creation with 7-Day PRO Trial)
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
    -- Frontend sends 'store_name', 'name' (for owner), and 'role'
    store_name := new.raw_user_meta_data->>'store_name';
    owner_name := COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'owner_name');
    
    -- Default role logic
    target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');

    -- 2. If store_name is present, create a store with 7-DAY PRO TRIAL
    IF store_name IS NOT NULL THEN
        INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email)
        VALUES (
            store_name, 
            'pro',                      -- Set initial plan to PRO
            NOW() + INTERVAL '7 days',  -- 7-Day Trial
            NOW() + INTERVAL '7 days',  -- Expiry same as trial
            new.id, 
            owner_name, 
            new.email
        )
        RETURNING id INTO new_store_id;
        
        target_role := 'owner';
    ELSE
        -- Staff registration or generic signup without store
        BEGIN
            new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
        EXCEPTION WHEN OTHERS THEN
            new_store_id := NULL;
        END;
    END IF;

    -- 3. Create Profile
    INSERT INTO public.profiles (id, username, name, email, role, store_id)
    VALUES (
        new.id, 
        new.email, -- username default to email
        COALESCE(owner_name, new.email),
        new.email, 
        target_role, 
        new_store_id 
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Notify
NOTIFY pgrst, 'reload schema';
