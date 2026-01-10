-- FIX: Ensure Products and Categories have correct RLS policies
-- This addresses the issue where photos/updates aren't saved because RLS blocks the UPDATE.

-- 1. Products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS multitenant_products ON public.products;
DROP POLICY IF EXISTS multitenant_products_policy ON public.products;

CREATE POLICY multitenant_products_policy ON public.products
FOR ALL USING (
    -- Read/Write: Super Admin OR Store Member
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin' 
    OR store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
) WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin' 
    OR store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
);

-- 2. Categories (Just in case)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS multitenant_categories ON public.categories;
DROP POLICY IF EXISTS multitenant_categories_policy ON public.categories;

CREATE POLICY multitenant_categories_policy ON public.categories
FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin' 
    OR store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
) WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin' 
    OR store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
);

-- Verify
DO $$ 
BEGIN
    RAISE NOTICE 'Fixed RLS policies for Products and Categories.';
END $$;
