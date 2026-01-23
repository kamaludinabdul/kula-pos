-- Deep Diagnostic Script
-- Run this in Supabase SQL Editor to see what the database is actually seeing

-- 1. Check current user context
SELECT 
    auth.uid() as current_user_uid,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as auth_email;

-- 2. Check profile record
SELECT 
    id, 
    email, 
    role, 
    store_id,
    (SELECT name FROM stores WHERE id = profiles.store_id) as store_name
FROM profiles 
WHERE id = auth.uid();

-- 3. Check if helper functions work
SELECT 
    public.get_my_store_id() as helper_store_id,
    public.is_super_admin() as helper_is_super_admin;

-- 4. Test RLS bypass via direct select with store_id filtering
-- Replace with the store_id from step 2 if the helper returns null
SELECT COUNT(*) as products_visible_with_filter
FROM products 
WHERE store_id = (SELECT store_id FROM profiles WHERE id = auth.uid());

-- 5. Test RPC function directly
-- Replace the UUID with the one found in step 2
-- SELECT * FROM get_store_initial_snapshot('PUT-STORE-ID-HERE'::uuid);

-- 6. Check if RLS is actually enabled
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('products', 'categories', 'profiles', 'stores');
