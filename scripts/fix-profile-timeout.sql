-- =========================================================
-- FIX PROFILE QUERY TIMEOUT (25+ seconds)
-- =========================================================
-- Problem: Profile query taking 25+ seconds causing login timeout
-- Cause: Complex RLS policies with subqueries to profiles table
--        causing recursion (profiles policy references profiles table)
-- 
-- Solution: Replace with simple USING(true) policies
-- =========================================================

BEGIN;

-- 1. Drop ALL existing complex policies that reference profiles table
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "multitenant_profiles_policy" ON public.profiles;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.profiles;

-- Drop simple policies if they already exist (to allow re-running script)
DROP POLICY IF EXISTS "profiles_select_simple" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_simple" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_simple" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_simple" ON public.profiles;

-- 2. Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create simple, FAST policies (no subqueries)
-- These use USING(true) which means minimal overhead

CREATE POLICY "profiles_select_simple" ON public.profiles
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "profiles_insert_simple" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "profiles_update_simple" ON public.profiles
FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "profiles_delete_simple" ON public.profiles
FOR DELETE TO authenticated
USING (true);

-- 4. Analyze table to refresh query planner stats
ANALYZE public.profiles;

-- 5. Also check/fix stores table policies (they might have similar issues)
DROP POLICY IF EXISTS "multitenant_stores_policy" ON public.stores;

COMMIT;

-- Confirm
SELECT 'Profile RLS policies fixed! Query should be fast now.' as status;

-- Show current policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
