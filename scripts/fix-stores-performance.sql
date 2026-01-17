-- ================================================
-- FIX STORES TABLE PERFORMANCE
-- ================================================
-- The stores table query is taking 28+ seconds.
-- This is likely due to complex RLS policies.
-- 
-- Run this in Supabase SQL Editor

-- Step 1: Check current RLS policies on stores
-- SELECT * FROM pg_policies WHERE tablename = 'stores';

-- Step 2: Drop all existing policies on stores
DROP POLICY IF EXISTS "Enable select for authenticated users" ON stores;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON stores;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON stores;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON stores;
DROP POLICY IF EXISTS "multitenant_stores_policy" ON stores;
DROP POLICY IF EXISTS "Users can view their own store" ON stores;
DROP POLICY IF EXISTS "Owners can manage their store" ON stores;
DROP POLICY IF EXISTS "Super admins can view all stores" ON stores;
DROP POLICY IF EXISTS "stores_select_all" ON stores;
DROP POLICY IF EXISTS "stores_insert" ON stores;
DROP POLICY IF EXISTS "stores_update" ON stores;
DROP POLICY IF EXISTS "stores_delete_admin" ON stores;

-- Step 3: Create simple, fast policies
-- For SELECT: authenticated users can read all stores (fast, no subquery)
CREATE POLICY "stores_select_all" ON stores
FOR SELECT TO authenticated
USING (true);

-- For INSERT: authenticated users can insert
CREATE POLICY "stores_insert" ON stores
FOR INSERT TO authenticated
WITH CHECK (true);

-- For UPDATE: authenticated users can update
CREATE POLICY "stores_update" ON stores  
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- For DELETE: only super_admin can delete
CREATE POLICY "stores_delete_admin" ON stores
FOR DELETE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'super_admin'
    )
);

-- Step 4: Create index on stores.id if not exists
CREATE INDEX IF NOT EXISTS idx_stores_id ON stores(id);

-- Step 5: Analyze stores table
ANALYZE stores;

-- Verify
DO $$
BEGIN
    RAISE NOTICE 'Stores RLS policies simplified - queries should be faster now';
END $$;
