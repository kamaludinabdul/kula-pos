
-- FIX: Add Missing Foreign Key Constraints to Enable PostgREST Joins
-- This script ensures that relationships between stores and profiles are formally defined.

BEGIN;

-- 1. Repair missing profiles (Tarik dari data Auth)
INSERT INTO public.profiles (id, email, name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'name', email), 'owner'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
AND email IN (SELECT email FROM public.stores); -- Only repair if they have a store

-- 2. Clean up potential orphaned owner_ids (Set to NULL if profile doesn't exist)
UPDATE public.stores
SET owner_id = p.id
FROM public.profiles p
WHERE stores.owner_id IS NULL 
AND stores.email = p.email;

-- 3. Add Foreign Key for Store -> Owner
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stores_owner_id_fkey' 
        AND table_name = 'stores'
    ) THEN
        ALTER TABLE public.stores 
        ADD CONSTRAINT stores_owner_id_fkey 
        FOREIGN KEY (owner_id) 
        REFERENCES public.profiles(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Add Foreign Key for Profile -> Store Assignment
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_store_id_fkey' 
        AND table_name = 'profiles'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_store_id_fkey 
        FOREIGN KEY (store_id) 
        REFERENCES public.stores(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Force-Sync Plan from Profile to Store (For Enterprise users)
UPDATE public.stores s
SET plan = p.plan,
    plan_expiry_date = p.plan_expiry_date
FROM public.profiles p
WHERE s.owner_id = p.id
AND p.plan = 'enterprise';

-- 6. Final check: Update profiles that might have the wrong role
UPDATE public.profiles
SET role = 'owner'
WHERE id IN (SELECT owner_id FROM public.stores WHERE owner_id IS NOT NULL)
AND role != 'super_admin'
AND role != 'owner';

COMMIT;

NOTIFY pgrst, 'reload schema';
