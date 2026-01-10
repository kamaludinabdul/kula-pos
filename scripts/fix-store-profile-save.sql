-- FIX: Allow Store Profile Updates and Ensure Columns Exist

-- 1. Ensure columns exist (Idempotent)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS logo TEXT,
ADD COLUMN IF NOT EXISTS latitude TEXT,
ADD COLUMN IF NOT EXISTS longitude TEXT;

-- 2. Relax RLS Policy for Store Updates
-- The previous policy might have restricted updates ONLY to owner_id matching auth.uid().
-- We need to allow users who belong to the store (get_my_store_id() = store.id) to update it 
-- (assuming they are authorized via app logic, or we can enforce role check).

DROP POLICY IF EXISTS multitenant_stores_policy ON public.stores;

CREATE POLICY multitenant_stores_policy ON public.stores
FOR ALL USING (
    -- Visibility: Super Admin OR Owner OR Member of the store
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin' 
    OR owner_id = auth.uid() 
    OR id = (SELECT store_id FROM profiles WHERE id = auth.uid())
) WITH CHECK (
    -- Write Access: Super Admin OR Owner OR Member of the store (so Admins can update settings)
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin' 
    OR owner_id = auth.uid() 
    OR id = (SELECT store_id FROM profiles WHERE id = auth.uid())
);

-- 3. Verify
DO $$ 
BEGIN
    RAISE NOTICE 'Fixed Store Profile columns and RLS policy.';
END $$;
