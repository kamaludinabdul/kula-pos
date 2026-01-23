-- Investigation: Why products are 0
-- This will check if the user is actually linked to the correct store

-- 1. Check current profile and its store_id
SELECT 
    id as profile_id,
    email,
    role,
    store_id
FROM profiles
WHERE id = auth.uid();

-- 2. Check all available stores
SELECT id, name, owner_id FROM stores;

-- 3. Check product counts per store_id (unfiltered)
-- Running this as super_admin or owner should show data
SELECT 
    store_id, 
    COUNT(*) as count 
FROM products 
GROUP BY store_id;

-- 4. Check if the user's store_id exists in the stores table
SELECT * FROM stores 
WHERE id = (SELECT store_id FROM profiles WHERE id = auth.uid());
