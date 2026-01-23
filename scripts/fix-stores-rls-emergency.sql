-- =========================================================
-- EMERGENCY FIX: Restore Stores RLS Policy
-- =========================================================
-- Problem: Previous script (fix-profile-timeout.sql) dropped 
-- "multitenant_stores_policy" but did not add a replacement.
-- This blocks all access to stores table when RLS is enabled.
-- =========================================================

BEGIN;

-- 1. Drop any broken policies
DROP POLICY IF EXISTS "multitenant_stores_policy" ON public.stores;
DROP POLICY IF EXISTS "stores_select_simple" ON public.stores;
DROP POLICY IF EXISTS "stores_insert_simple" ON public.stores;
DROP POLICY IF EXISTS "stores_update_simple" ON public.stores;
DROP POLICY IF EXISTS "stores_delete_simple" ON public.stores;

-- 2. Ensure RLS is enabled
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- 3. Create simple, permissive policies for authenticated users
CREATE POLICY "stores_select_simple" ON public.stores
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "stores_insert_simple" ON public.stores
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "stores_update_simple" ON public.stores
FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "stores_delete_simple" ON public.stores
FOR DELETE TO authenticated
USING (true);

-- 4. Analyze table
ANALYZE public.stores;

COMMIT;

-- Verification: After running, this query should return your stores:
-- SELECT id, name FROM stores;
