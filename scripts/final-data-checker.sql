-- FINAL DATA CHECKER
-- Check everything about the target store data

-- 1. Check if the profile belongs to the right store now
SELECT email, store_id, (SELECT name FROM stores WHERE id = store_id) as store_name
FROM profiles
WHERE email = 'rhpetshop25@gmail.com';

-- 2. Check categories for THIS store
SELECT id, name, store_id
FROM categories
WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid;

-- 3. Check products for THIS store
-- Also check if they are linked to these categories
SELECT 
    COUNT(*) as total_products,
    COUNT(*) FILTER (WHERE category_id IS NULL) as no_category,
    COUNT(*) FILTER (WHERE category_id IN (SELECT id FROM categories WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid)) as linked_to_valid_cat
FROM products
WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid;

-- 4. Test the snapshot directly with this UUID
SELECT get_store_initial_snapshot('b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid);
