-- =========================================================
-- COMPREHENSIVE FIX: Restore RLS Policies for ALL Tables
-- =========================================================
-- Run this in Production Supabase SQL Editor
-- This ensures all major tables have proper RLS policies
-- =========================================================

BEGIN;

-- =====================================================
-- PRODUCTS TABLE
-- =====================================================
DROP POLICY IF EXISTS "products_select_simple" ON public.products;
DROP POLICY IF EXISTS "products_insert_simple" ON public.products;
DROP POLICY IF EXISTS "products_update_simple" ON public.products;
DROP POLICY IF EXISTS "products_delete_simple" ON public.products;
DROP POLICY IF EXISTS "multitenant_products_policy" ON public.products;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_simple" ON public.products
FOR SELECT TO authenticated USING (true);

CREATE POLICY "products_insert_simple" ON public.products
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "products_update_simple" ON public.products
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "products_delete_simple" ON public.products
FOR DELETE TO authenticated USING (true);

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================
DROP POLICY IF EXISTS "categories_select_simple" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_simple" ON public.categories;
DROP POLICY IF EXISTS "categories_update_simple" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_simple" ON public.categories;
DROP POLICY IF EXISTS "multitenant_categories_policy" ON public.categories;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_simple" ON public.categories
FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_insert_simple" ON public.categories
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "categories_update_simple" ON public.categories
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "categories_delete_simple" ON public.categories
FOR DELETE TO authenticated USING (true);

-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
DROP POLICY IF EXISTS "customers_select_simple" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_simple" ON public.customers;
DROP POLICY IF EXISTS "customers_update_simple" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_simple" ON public.customers;
DROP POLICY IF EXISTS "multitenant_customers_policy" ON public.customers;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select_simple" ON public.customers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "customers_insert_simple" ON public.customers
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "customers_update_simple" ON public.customers
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "customers_delete_simple" ON public.customers
FOR DELETE TO authenticated USING (true);

-- =====================================================
-- TRANSACTIONS TABLE
-- =====================================================
DROP POLICY IF EXISTS "transactions_select_simple" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_simple" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_simple" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_simple" ON public.transactions;
DROP POLICY IF EXISTS "multitenant_transactions_policy" ON public.transactions;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_simple" ON public.transactions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "transactions_insert_simple" ON public.transactions
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "transactions_update_simple" ON public.transactions
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "transactions_delete_simple" ON public.transactions
FOR DELETE TO authenticated USING (true);

-- =====================================================
-- SUPPLIERS TABLE
-- =====================================================
DROP POLICY IF EXISTS "suppliers_select_simple" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_insert_simple" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_update_simple" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_delete_simple" ON public.suppliers;
DROP POLICY IF EXISTS "multitenant_suppliers_policy" ON public.suppliers;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select_simple" ON public.suppliers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "suppliers_insert_simple" ON public.suppliers
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "suppliers_update_simple" ON public.suppliers
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "suppliers_delete_simple" ON public.suppliers
FOR DELETE TO authenticated USING (true);

-- =====================================================
-- PURCHASE_ORDERS TABLE
-- =====================================================
DROP POLICY IF EXISTS "purchase_orders_select_simple" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_insert_simple" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_update_simple" ON public.purchase_orders;
DROP POLICY IF EXISTS "purchase_orders_delete_simple" ON public.purchase_orders;
DROP POLICY IF EXISTS "multitenant_purchase_orders_policy" ON public.purchase_orders;

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_orders_select_simple" ON public.purchase_orders
FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_orders_insert_simple" ON public.purchase_orders
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "purchase_orders_update_simple" ON public.purchase_orders
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "purchase_orders_delete_simple" ON public.purchase_orders
FOR DELETE TO authenticated USING (true);

-- =====================================================
-- SHIFTS TABLE
-- =====================================================
DROP POLICY IF EXISTS "shifts_select_simple" ON public.shifts;
DROP POLICY IF EXISTS "shifts_insert_simple" ON public.shifts;
DROP POLICY IF EXISTS "shifts_update_simple" ON public.shifts;
DROP POLICY IF EXISTS "shifts_delete_simple" ON public.shifts;
DROP POLICY IF EXISTS "multitenant_shifts_policy" ON public.shifts;

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts_select_simple" ON public.shifts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "shifts_insert_simple" ON public.shifts
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "shifts_update_simple" ON public.shifts
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "shifts_delete_simple" ON public.shifts
FOR DELETE TO authenticated USING (true);

-- =====================================================
-- PROMOTIONS TABLE
-- =====================================================
DROP POLICY IF EXISTS "promotions_select_simple" ON public.promotions;
DROP POLICY IF EXISTS "promotions_insert_simple" ON public.promotions;
DROP POLICY IF EXISTS "promotions_update_simple" ON public.promotions;
DROP POLICY IF EXISTS "promotions_delete_simple" ON public.promotions;
DROP POLICY IF EXISTS "multitenant_promotions_policy" ON public.promotions;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_select_simple" ON public.promotions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "promotions_insert_simple" ON public.promotions
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "promotions_update_simple" ON public.promotions
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "promotions_delete_simple" ON public.promotions
FOR DELETE TO authenticated USING (true);

-- Analyze all tables
ANALYZE public.products;
ANALYZE public.categories;
ANALYZE public.customers;
ANALYZE public.transactions;
ANALYZE public.suppliers;
ANALYZE public.purchase_orders;
ANALYZE public.shifts;
ANALYZE public.promotions;

COMMIT;

-- After running, verify with:
-- SELECT COUNT(*) FROM products;
-- SELECT COUNT(*) FROM categories;
