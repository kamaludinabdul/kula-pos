-- Allow Admins/Owners to manage ALL profiles
-- This is necessary because Admins create/edit profiles for OTHER users (Staff)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1. INSERT: Allow authenticated users to create profiles
-- (Needed for Registration & Admin adding staff)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
CREATE POLICY "Enable insert for authenticated users"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. SELECT: Allow authenticated users to view all profiles
-- (Needed for Staff list, caching, etc)
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.profiles;
CREATE POLICY "Enable select for authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 3. UPDATE: Allow authenticated users to update profiles
-- (Needed for Admin editing Staff, adjusting roles, etc)
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.profiles;
CREATE POLICY "Enable update for authenticated users"
ON public.profiles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. DELETE: Allow authenticated users to delete profiles
-- (Needed for Admin removing Staff)
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.profiles;
CREATE POLICY "Enable delete for authenticated users"
ON public.profiles
FOR DELETE
TO authenticated
USING (true);
