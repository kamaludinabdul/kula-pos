-- PRODUCTION HOTFIX: Fix Store Creation & Terminology
-- Run this in Supabase SQL Editor to fix missing stores and schema issues.

-- 1. FIX SCHEMA
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'general';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS plan_expiry_date TIMESTAMPTZ;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

-- 2. UPDATE ROBUST TRIGGER (Version with Business Type)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_store_id UUID;
    v_store_name TEXT;
    v_owner_name TEXT;
    v_target_role TEXT;
    v_biz_type TEXT;
BEGIN
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

        -- A. Profile
        INSERT INTO public.profiles (id, username, name, email, role, plan, status)
        VALUES (
            new.id, 
            new.email, 
            v_owner_name,
            new.email, 
            v_target_role,
            CASE WHEN v_store_name IS NOT NULL AND v_store_name <> '' THEN 'pro' ELSE 'free' END,
            'online'
        ) ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name,
            username = EXCLUDED.username;

        -- B. Store
        IF v_store_name IS NOT NULL AND v_store_name <> '' THEN
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
            
            UPDATE public.profiles SET 
                store_id = new_store_id,
                role = 'owner',
                plan = 'pro',
                plan_expiry_date = NOW() + INTERVAL '7 days'
            WHERE id = new.id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.debug_logs (location, error_message, payload)
        VALUES ('hotfix_trigger_failed', SQLERRM, row_to_json(new)::jsonb);
    END;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. RECOVERY: Create missing stores for owners who signed up but don't have one
DO $$
DECLARE
    r RECORD;
    v_new_store_id UUID;
BEGIN
    FOR r IN 
        SELECT p.id as user_id, p.name as owner_name, p.email, u.raw_user_meta_data->>'store_name' as s_name, u.raw_user_meta_data->>'business_type' as b_type
        FROM public.profiles p
        JOIN auth.users u ON p.id = u.id
        WHERE p.role = 'owner' 
          AND p.store_id IS NULL 
          AND u.raw_user_meta_data->>'store_name' IS NOT NULL
    LOOP
        INSERT INTO public.stores (name, plan, trial_ends_at, plan_expiry_date, owner_id, owner_name, email, business_type)
        VALUES (
            r.s_name, 
            'pro', 
            NOW() + INTERVAL '7 days', 
            NOW() + INTERVAL '7 days', 
            r.user_id, 
            r.owner_name, 
            r.email, 
            COALESCE(r.b_type, 'general')
        )
        RETURNING id INTO v_new_store_id;

        UPDATE public.profiles SET store_id = v_new_store_id WHERE id = r.user_id;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
