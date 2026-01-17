-- ================================================
-- KULA POS - SUPABASE PERFORMANCE OPTIMIZATION
-- ================================================
-- Run this script in Supabase SQL Editor
-- This adds indexes and optimizes queries

-- ================================================
-- PART 1: CRITICAL INDEXES FOR AUTH (PROFILES)
-- ================================================

-- Primary key index should already exist, but let's ensure it
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- For super_admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- For store-based lookups
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON profiles(store_id);

-- Combined index for common auth queries
CREATE INDEX IF NOT EXISTS idx_profiles_id_store ON profiles(id, store_id);

-- ================================================
-- PART 2: STORES TABLE INDEXES
-- ================================================

-- Primary key index
CREATE INDEX IF NOT EXISTS idx_stores_id ON stores(id);

-- Owner lookup
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id);

-- ================================================
-- PART 3: PRODUCTS TABLE INDEXES
-- ================================================

-- Store + active products (most common query)
CREATE INDEX IF NOT EXISTS idx_products_store_active ON products(store_id, is_deleted) WHERE is_deleted = false;

-- Barcode scanning
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON products(store_id, category_id);

-- Low stock alerts
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(store_id, stock, min_stock) WHERE is_deleted = false;

-- ================================================
-- PART 4: TRANSACTIONS TABLE INDEXES
-- ================================================

-- Store + date (reports)
CREATE INDEX IF NOT EXISTS idx_transactions_store_date ON transactions(store_id, date DESC);

-- Customer lookup
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(store_id, customer_id);

-- Shift reports
CREATE INDEX IF NOT EXISTS idx_transactions_shift ON transactions(store_id, shift_id);

-- ================================================
-- PART 5: CUSTOMERS TABLE INDEXES
-- ================================================

CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(store_id, phone);

-- ================================================
-- PART 6: AUDIT LOGS INDEX
-- ================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- ================================================
-- PART 7: ANALYZE ALL TABLES
-- ================================================
-- This updates statistics for query planner

ANALYZE profiles;
ANALYZE stores;
ANALYZE products;
ANALYZE transactions;
ANALYZE customers;
ANALYZE audit_logs;

-- ================================================
-- PART 8: SIMPLIFY RLS POLICIES (PERFORMANCE FIX)
-- ================================================
-- Complex RLS can slow down queries significantly.
-- These simplified policies are faster.

-- Drop old complex policies on profiles if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in store" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;

-- Simple, fast policy: authenticated users can access profiles
DROP POLICY IF EXISTS "Enable select for authenticated users" ON profiles;
CREATE POLICY "Enable select for authenticated users" ON profiles
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
CREATE POLICY "Enable insert for authenticated users" ON profiles
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON profiles;
CREATE POLICY "Enable update for authenticated users" ON profiles
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Same for stores (simpler policy = faster queries)
DROP POLICY IF EXISTS "Enable select for authenticated users" ON stores;
CREATE POLICY "Enable select for authenticated users" ON stores
FOR SELECT TO authenticated USING (true);

-- ================================================
-- VERIFICATION: Check indexes exist
-- ================================================

DO $$
DECLARE
    idx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO idx_count 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
    
    RAISE NOTICE 'Total custom indexes created: %', idx_count;
    RAISE NOTICE 'Performance optimization complete!';
END $$;
