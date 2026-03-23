-- DEFINITIVE FIX FOR REGISTRATION 500 ERROR
-- This script fixes the schema mismatch and foreign key violations blocking signups.

BEGIN;

-- 1. Ensure debug_logs table exists for capturing errors
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id BIGSERIAL PRIMARY KEY,
    location TEXT,
    error_message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure subscription_plans table has all necessary columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'business_type') THEN
        ALTER TABLE public.subscription_plans ADD COLUMN business_type TEXT DEFAULT 'general';
    END IF;
END $$;

-- 3. Populate subscription_plans with standard and business-specific plans
-- This ensures that 'pro' and 'pet_clinic_pro' both exist as valid foreign key targets.
INSERT INTO public.subscription_plans (id, name, business_type, max_products, max_stores, max_staff, price, features)
VALUES 
    -- General Plans
    ('free', 'Free', 'general', 50, 1, 1, 0, '[]'),
    ('pro', 'Pro', 'general', 500, 3, 5, 150000, '["reports.profit_loss", "reports.cash_flow", "products.stock_history"]'),
    ('enterprise', 'Enterprise', 'general', 10000, 10, 50, 350000, '["reports.profit_loss", "reports.cash_flow", "smart_insights", "features.ai_bundling"]'),
    
    -- Pet Clinic Plans (matching the pattern in businessTypes.js)
    ('pet_clinic_free', 'Pet Shop Free', 'pet_clinic', 50, 1, 1, 0, '[]'),
    ('pet_clinic_pro', 'Pet Shop Pro', 'pet_clinic', 500, 3, 10, 250000, '["pet_hotel", "pet_grooming", "pet_clinic_emr", "reports.profit_loss"]'),
    ('pet_clinic_enterprise', 'Pet Shop Enterprise', 'pet_clinic', -1, 10, -1, 500000, '["pet_hotel", "pet_grooming", "pet_clinic_emr", "smart_insights"]')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    business_type = EXCLUDED.business_type,
    max_products = EXCLUDED.max_products,
    max_stores = EXCLUDED.max_stores,
    max_staff = EXCLUDED.max_staff,
    features = EXCLUDED.features;

-- 4. Repair stores table plan column and constraint
-- If the constraint is named stores_plan_id_fkey but refers to a missing column, it will error here.
-- We ensure the 'plan' column exists and is the one being checked.
DO $$
BEGIN
    -- Ensure plan column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stores' AND column_name = 'plan') THEN
        ALTER TABLE public.stores ADD COLUMN plan TEXT DEFAULT 'free';
    END IF;

    -- Drop existing problematic constraint if it exists under the name seen in logs
    -- This handles cases where it might have been named stores_plan_id_fkey but points to 'plan'
    ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_plan_id_fkey;
    ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_plan_fkey;

    -- Add a clean constraint
    ALTER TABLE public.stores 
    ADD CONSTRAINT stores_plan_fkey 
    FOREIGN KEY (plan) 
    REFERENCES public.subscription_plans(id)
    ON UPDATE CASCADE;
END $$;

-- 5. Updated handle_new_user Trigger
-- This version handles business-specific plan IDs (e.g., pet_clinic_pro)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_new_store_id UUID;
    v_store_name TEXT;
    v_owner_name TEXT;
    v_target_role TEXT;
    v_biz_type TEXT;
    v_plan_id TEXT;
BEGIN
    -- Extract metadata
    v_store_name := new.raw_user_meta_data->>'store_name';
    v_owner_name := COALESCE(
        new.raw_user_meta_data->>'name', 
        new.raw_user_meta_data->>'full_name', 
        new.raw_user_meta_data->>'owner_name',
        split_part(new.email, '@', 1)
    );
    v_target_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
    v_biz_type := COALESCE(new.raw_user_meta_data->>'business_type', 'general');

    -- Determine Plan ID based on business type
    -- If business type is not general, we try to use business_type_pro, else fallback to pro
    IF v_biz_type = 'general' OR v_biz_type IS NULL THEN
        v_plan_id := 'pro';
    ELSE
        -- e.g., 'pet_clinic_pro' or 'pharmacy_pro'
        v_plan_id := v_biz_type || '_pro';
        
        -- Safety Check: Fallback to 'pro' if specific plan doesn't exist in subscription_plans
        IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE id = v_plan_id) THEN
            v_plan_id := 'pro';
        END IF;
    END IF;

    BEGIN
        -- A. Create Profile
        INSERT INTO public.profiles (id, username, name, email, role, plan, status)
        VALUES (
            new.id, 
            new.email, 
            v_owner_name,
            new.email, 
            v_target_role,
            CASE WHEN v_store_name IS NOT NULL AND v_store_name <> '' THEN v_plan_id ELSE 'free' END,
            'online'
        ) 
        ON CONFLICT (id) DO UPDATE SET 
            name = EXCLUDED.name,
            email = EXCLUDED.email;

        -- B. Create Store
        IF v_store_name IS NOT NULL AND v_store_name <> '' THEN
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
                v_store_name, 
                v_plan_id,
                NOW() + INTERVAL '7 days',  
                NOW() + INTERVAL '7 days',  
                new.id, 
                v_owner_name, 
                new.email,
                v_biz_type
            )
            RETURNING id INTO v_new_store_id;
            
            -- C. Link Profile to Store
            UPDATE public.profiles SET 
                store_id = v_new_store_id,
                role = 'owner',
                plan = v_plan_id,
                plan_expiry_date = NOW() + INTERVAL '7 days'
            WHERE id = new.id;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- Log internal error to debug_logs but don't fail the whole transaction if possible
        -- (Though usually an exception in a trigger fails the whole operation)
        INSERT INTO public.debug_logs (location, error_message, payload)
        VALUES ('handle_new_user_failure', SQLERRM, row_to_json(new)::jsonb);
        RAISE EXCEPTION 'Registration failed because of database error: %', SQLERRM;
    END;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure schema visibility
ALTER FUNCTION public.handle_new_user() SET search_path = public;

COMMIT;
