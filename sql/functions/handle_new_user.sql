-- MASTER: handle_new_user
-- Purpose: Trigger function for Auth.users entry to create profile and store
-- Source: scripts/deploy_prod.sql

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
    store_name TEXT;
    owner_name TEXT;
    target_role TEXT;
BEGIN
    store_name := new.raw_user_meta_data->>'store_name';
    owner_name := COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'owner_name');
    target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');

    IF store_name IS NOT NULL THEN
        INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email)
        VALUES (
            store_name, 
            'pro',                      
            NOW() + INTERVAL '7 days',  
            NOW() + INTERVAL '7 days',  
            new.id, 
            owner_name, 
            new.email
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

    INSERT INTO public.profiles (id, username, name, email, role, store_id)
    VALUES (
        new.id, 
        new.email, 
        COALESCE(owner_name, new.email),
        new.email, 
        target_role, 
        new_store_id 
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
