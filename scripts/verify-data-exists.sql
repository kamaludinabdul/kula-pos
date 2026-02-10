-- =====================================================================================
-- VERIFY: Does data actually exist in the database?
-- Run this in Supabase SQL Editor. It runs as admin so it bypasses RLS.
-- If results show 0, the data has been DELETED and needs to be restored.
-- =====================================================================================

-- 1. Show ALL stores and their data counts
SELECT 
    s.id as store_id,
    s.name as store_name,
    s.owner_id,
    s.email,
    (SELECT count(*) FROM products p WHERE p.store_id = s.id) as total_products,
    (SELECT count(*) FROM products p WHERE p.store_id = s.id AND p.is_deleted = false) as active_products,
    (SELECT count(*) FROM transactions t WHERE t.store_id = s.id) as total_transactions,
    (SELECT count(*) FROM customers c WHERE c.store_id = s.id) as total_customers,
    (SELECT count(*) FROM categories cat WHERE cat.store_id = s.id) as total_categories,
    (SELECT count(*) FROM cash_flow cf WHERE cf.store_id = s.id) as total_cashflow,
    (SELECT count(*) FROM suppliers sup WHERE sup.store_id = s.id) as total_suppliers
FROM stores s
ORDER BY s.created_at DESC;

-- 2. Show ALL profiles and their store links
SELECT 
    p.id as user_id,
    p.email,
    p.name,
    p.role,
    p.store_id,
    s.name as store_name
FROM profiles p
LEFT JOIN stores s ON s.id = p.store_id
ORDER BY p.created_at DESC;

-- 3. Test get_my_store_id function (will return NULL here because SQL Editor doesn't have auth.uid())
-- This is expected to be NULL - it's just to confirm the function exists
SELECT get_my_store_id() as my_store_id;
