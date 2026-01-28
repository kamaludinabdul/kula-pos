-- =====================================================================================
-- TRIGGER: Handle New User Registration (Profile & Store Creation)
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
    owner_name := new.raw_user_meta_data->>'owner_name';
    
    -- Default role logic: If creating a store, you are owner. If invited, logic might differ but assuming owner for now if store_name provided.
    target_role := 'staff';

    -- 2. If store_name is present, create a store
    IF store_name IS NOT NULL THEN
        INSERT INTO public.stores (name, plan, owner_id)
        VALUES (store_name, 'free', new.id)
        RETURNING id INTO new_store_id;
        
        target_role := 'owner';
    ELSE
        -- Attempt to find if invited? (Advanced logic omitted for MVP)
        -- For now, if no store_name, check if store_id passed in metadata
        -- new_store_id := (new.raw_user_meta_data->>'store_id')::UUID;
        NULL;
    END IF;

    -- 3. Create Profile
    INSERT INTO public.profiles (id, username, email, role, store_id)
    VALUES (
        new.id, 
        COALESCE(owner_name, new.raw_user_meta_data->>'full_name', new.email),
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
