-- Phase 8: Migrate Plan to Owner
-- 1. Add plan columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free',
ADD COLUMN IF NOT EXISTS plan_expiry_date timestamptz;

-- 2. Migrate existing plan data
-- Logic: Assign the HIGHEST plan found across all of an owner's stores to the owner profile.
-- Enterprise > Pro > Free

DO $$
DECLARE
    r RECORD;
    highest_plan text;
    latest_expiry timestamptz;
BEGIN
    FOR r IN SELECT id FROM profiles WHERE role = 'owner' LOOP
        -- Default
        highest_plan := 'free';
        latest_expiry := NULL;

        -- Check Enterprise
        IF EXISTS (SELECT 1 FROM stores WHERE owner_id = r.id AND plan = 'enterprise') THEN
            highest_plan := 'enterprise';
        ELSIF EXISTS (SELECT 1 FROM stores WHERE owner_id = r.id AND plan = 'pro') THEN
            highest_plan := 'pro';
        END IF;

        -- Get latest expiry from ANY store (simplified logic, ideally matches the plan)
        SELECT MAX(plan_expiry_date) INTO latest_expiry FROM stores WHERE owner_id = r.id;

        -- Update Profile
        UPDATE profiles 
        SET plan = highest_plan, 
            plan_expiry_date = latest_expiry
        WHERE id = r.id;
        
        RAISE NOTICE 'Updated User %: Plan %, Expiry %', r.id, highest_plan, latest_expiry;
    END LOOP;
END $$;

-- 3. (Optional) Cleanup - We keep stores.plan for now as backup/history but UI will ignore it.
