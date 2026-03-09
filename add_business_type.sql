-- Migration: Add business_type column to stores table
-- This column identifies the type of business and is set permanently at registration.
-- Values: 'general', 'fnb', 'pharmacy', 'pet_clinic', 'laundry', 'rental'

-- Step 1: Add the column (safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'stores' 
        AND column_name = 'business_type'
    ) THEN
        ALTER TABLE public.stores ADD COLUMN business_type TEXT DEFAULT 'general';
    END IF;
END $$;

-- Step 2: Deploy updated handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
    store_name TEXT;
    owner_name TEXT;
    target_role TEXT;
    biz_type TEXT;
BEGIN
    store_name := new.raw_user_meta_data->>'store_name';
    owner_name := COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'owner_name');
    target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
    biz_type := COALESCE(new.raw_user_meta_data->>'business_type', 'general');

    IF store_name IS NOT NULL THEN
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
