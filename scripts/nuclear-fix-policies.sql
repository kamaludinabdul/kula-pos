-- =========================================================
-- DIAGNOSTIC + NUCLEAR FIX FOR PROFILES INFINITE RECURSION
-- =========================================================
-- Run this in Supabase SQL Editor for Production

-- STEP 1: List ALL policies on profiles (for diagnosis)
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';

-- STEP 2: DROP ABSOLUTELY EVERYTHING ON PROFILES
DROP POLICY IF EXISTS "multitenant_profiles_policy" ON profiles;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in store" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

-- STEP 3: Verify all policies are gone
SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
-- Should return 0 rows

-- STEP 4: Create ONLY the simplest possible policies
CREATE POLICY "allow_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "allow_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_update" ON profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- STEP 5: Same for stores
DROP POLICY IF EXISTS "multitenant_stores_policy" ON stores;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON stores;
DROP POLICY IF EXISTS "stores_select_policy" ON stores;

CREATE POLICY "allow_select" ON stores FOR SELECT TO authenticated USING (true);

-- STEP 6: Reset cache
ANALYZE profiles;
ANALYZE stores;

-- STEP 7: Verify new policies
SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('profiles', 'stores');
