-- Check and Fix RLS Policies for Products and Related Tables
-- This script will help diagnose why products are not showing

-- First, let's check current RLS status
SELECT 
    schemaname,
    tablename, 
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
AND tablename IN ('products', 'categories', 'stock_movements', 'stock_opnames')
ORDER BY tablename;

-- Check existing policies for products table
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'products';

-- If no policies or broken policies, add proper ones
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view products from their store" ON products;
DROP POLICY IF EXISTS "Users can insert products to their store" ON products;
DROP POLICY IF EXISTS "Users can update products in their store" ON products;
DROP POLICY IF EXISTS "Users can delete products from their store" ON products;
DROP POLICY IF EXISTS "Super admin can view all products" ON products;
DROP POLICY IF EXISTS "Super admin can manage all products" ON products;

-- Create comprehensive RLS policies for products
CREATE POLICY "Users can view products from their store"
ON products FOR SELECT
USING (
    store_id IN (
        SELECT store_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert products to their store"
ON products FOR INSERT
WITH CHECK (
    store_id IN (
        SELECT store_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update products in their store"
ON products FOR UPDATE
USING (
    store_id IN (
        SELECT store_id FROM profiles WHERE id = auth.uid()
    )
)
WITH CHECK (
    store_id IN (
        SELECT store_id FROM profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can delete products from their store"
ON products FOR DELETE
USING (
    store_id IN (
        SELECT store_id FROM profiles WHERE id = auth.uid()
    )
);

-- Super admin policies
CREATE POLICY "Super admin can view all products"
ON products FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    )
);

CREATE POLICY "Super admin can manage all products"
ON products FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    )
);

-- Ensure RLS is enabled
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Check if get_products_page function has security definer
SELECT 
    p.proname as function_name,
    p.prosecdef as security_definer,
    r.rolname as owner
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid
WHERE p.proname = 'get_products_page';

-- If function is not SECURITY DEFINER, it might not bypass RLS
-- Let's make sure it has proper access
ALTER FUNCTION get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT) 
SECURITY DEFINER;

-- Test query to see if products exist in database
SELECT 
    COUNT(*) as total_products,
    store_id,
    COUNT(*) FILTER (WHERE is_deleted = false) as active_products
FROM products
GROUP BY store_id;

-- Test the RPC function
-- Replace 'your-store-id' with actual store_id
-- SELECT * FROM get_products_page(
--     'your-store-id'::uuid,
--     1, -- page
--     10, -- page_size
--     '', -- search
--     'all', -- category
--     'all', -- satuan_po
--     'name', -- sort_key
--     'asc' -- sort_dir
-- );
