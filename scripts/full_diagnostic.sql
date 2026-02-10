-- ============================================================
-- FULL DIAGNOSTIC: Why is ALL data empty for rhpetshop25@gmail.com?
-- Run this in Supabase SQL Editor (as admin/service role)
-- ============================================================

-- 1. Check if get_my_store_id() function exists and works
SELECT 
    'get_my_store_id function exists' as check_name,
    EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_my_store_id'
    ) as result;

-- 2. Check the user's profile and store_id
SELECT 
    'User Profile' as check_name,
    p.id as user_id,
    p.email,
    p.role,
    p.store_id,
    p.name
FROM profiles p
WHERE p.email = 'rhpetshop25@gmail.com';

-- 3. Check the store exists and is active
SELECT 
    'Store Status' as check_name,
    s.id,
    s.name as store_name,
    s.status,
    s.owner_id
FROM stores s
WHERE s.id = (SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com');

-- 4. COUNT data in ALL major tables for this store (bypasses RLS because run as admin)
SELECT 
    'products' as table_name, 
    count(*) as total_rows,
    count(*) FILTER (WHERE is_deleted = false) as active_rows
FROM products 
WHERE store_id = (SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com')

UNION ALL

SELECT 'transactions', count(*), count(*) FILTER (WHERE status = 'completed')
FROM transactions 
WHERE store_id = (SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com')

UNION ALL

SELECT 'customers', count(*), count(*)
FROM customers 
WHERE store_id = (SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com')

UNION ALL

SELECT 'categories', count(*), count(*)
FROM categories 
WHERE store_id = (SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com')

UNION ALL

SELECT 'cash_flow', count(*), count(*)
FROM cash_flow 
WHERE store_id = (SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com')

UNION ALL

SELECT 'shifts', count(*), count(*)
FROM shifts 
WHERE store_id = (SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com')

UNION ALL

SELECT 'suppliers', count(*), count(*)
FROM suppliers 
WHERE store_id = (SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com')

UNION ALL

SELECT 'promotions', count(*), count(*)
FROM promotions 
WHERE store_id = (SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com');

-- 5. Check RLS policies on products table
SELECT 
    schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'products';

-- 6. Check if there are ANY other stores with data
SELECT 
    s.id as store_id,
    s.name as store_name,
    (SELECT count(*) FROM products p WHERE p.store_id = s.id AND p.is_deleted = false) as product_count,
    (SELECT count(*) FROM transactions t WHERE t.store_id = s.id) as transaction_count
FROM stores s
ORDER BY s.created_at DESC
LIMIT 10;
