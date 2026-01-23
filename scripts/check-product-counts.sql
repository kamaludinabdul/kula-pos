-- Diagnostic: Check products data and schema
-- This will help us understand why counts are returning 0

-- 1. Check actual column names for products table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'products';

-- 2. Check a few sample products for a store to see their flags
-- Replace the UUID with the store_id from your profile
SELECT 
    id, 
    name, 
    store_id, 
    category_id, 
    is_deleted, 
    stock, 
    buy_price
FROM products 
WHERE store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
LIMIT 5;

-- 3. Check counts with and without filters
SELECT 
    COUNT(*) as total_raw,
    COUNT(*) FILTER (WHERE is_deleted = false) as active_false,
    COUNT(*) FILTER (WHERE is_deleted IS NULL) as active_null,
    COUNT(*) FILTER (WHERE is_deleted = true) as deleted_true
FROM products 
WHERE store_id = (SELECT store_id FROM profiles WHERE id = auth.uid());

-- 4. Check categories and their product links
SELECT 
    c.name, 
    c.id, 
    (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as linked_products
FROM categories c
WHERE c.store_id = (SELECT store_id FROM profiles WHERE id = auth.uid());
