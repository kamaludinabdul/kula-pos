-- =====================================================================================
-- KASIR PRO SUPABASE - PRODUCTION SCHEMA CONSOLIDATION SCRIPT
-- =====================================================================================
-- This script brings a production database up to parity with the latest development state.
-- It is Idempotent: Can be run multiple times safeley (checks for existing columns).
-- =====================================================================================

BEGIN;

-- 1. BASE TABLES & COLUMNS
-- =====================================================================================

-- 1.1 PROFILES
-- Ensure critical columns exist
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_force_logout_at TIMESTAMPTZ;
END $$;

-- 1.2 STORES
-- Add feature flags and settings
DO $$ BEGIN
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS enable_rental BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS enable_discount BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS discount_pin TEXT;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS service_charge NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'exclusive';
END $$;

-- 1.3 PRODUCTS
-- Add new fields for rental, detailed inventory, and robust POS features
DO $$ BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'product';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS revenue NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percent';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN DEFAULT false;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_unit TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS conversion_to_unit NUMERIC(15, 2);
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight NUMERIC(15, 2);
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rack_location TEXT;
    -- Rental & Bundling
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_bundling_enabled BOOLEAN DEFAULT false;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'standard';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]'::jsonb;
END $$;

-- 1.4 TRANSACTIONS
-- Add payment details and linkage
DO $$ BEGIN
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "change" NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS points_earned NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'sale';
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS rental_session_id UUID;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) DEFAULT 0;
END $$;

-- 1.5 SHIFT MOVEMENTS (Cash Flow Alignment)
DO $$ BEGIN
    ALTER TABLE public.shift_movements ADD COLUMN IF NOT EXISTS expense_group TEXT DEFAULT 'operational';
END $$;

-- 2. AUDIT LOGS (If missing)
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Ensure Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 3. INDEXES (Performance Optimization)
-- =====================================================================================
-- FK Indexes
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_store_id ON transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift_id ON transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_users_store_id ON profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);
-- Filter Indexes
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_store_date ON transactions(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_products_store_search ON products(store_id, name, barcode) WHERE is_deleted = false;

-- 4. SECURITY (RLS Policies)
-- =====================================================================================

-- 4.1 Enable RLS Globally on all public tables
DO $$ 
DECLARE tbl RECORD;
BEGIN 
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP 
        EXECUTE 'ALTER TABLE ' || quote_ident(tbl.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

-- 4.2 Fix PROFILES RLS (Allow Admin to Manager Staff)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
CREATE POLICY "Enable insert for authenticated users" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.profiles;
CREATE POLICY "Enable select for authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.profiles;
CREATE POLICY "Enable update for authenticated users" ON public.profiles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.profiles;
CREATE POLICY "Enable delete for authenticated users" ON public.profiles FOR DELETE TO authenticated USING (true);


-- 4.3 Fix Multi-Tenant missing policies
DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY['pets', 'medical_records', 'rooms'];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables LOOP 
        EXECUTE format('
            DROP POLICY IF EXISTS multitenant_%I_policy ON %I;
            CREATE POLICY multitenant_%I_policy ON %I
            FOR ALL USING (
                auth.uid() IN (SELECT id FROM profiles WHERE role = ''super_admin'') 
                OR store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
            ) WITH CHECK (
                auth.uid() IN (SELECT id FROM profiles WHERE role = ''super_admin'') 
                OR store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
            );', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;


-- 5. FUNCTION & VIEW HARDENING (Security Invoker)
-- =====================================================================================
DO $$ BEGIN
    EXECUTE 'ALTER VIEW IF EXISTS v_low_stock_alerts SET (security_invoker = on)';
    EXECUTE 'ALTER VIEW IF EXISTS product_sales_analytics SET (security_invoker = on)';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set security_invoker on views - possibly version mismatch or view missing';
END $$;


COMMIT;

-- 6. RPC Fixes (Search Path Vulnerability Fix)
-- Must be outside transaction block for some Postgres versions if creating new funcs, but ALTER is fine.
ALTER FUNCTION public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public;
ALTER FUNCTION public.get_product_sales_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public;
ALTER FUNCTION public.reset_loyalty_points(UUID) SET search_path = public;
-- (Add others if necessary, but these are the critical reporting ones recently touched)

NOTIFY pgrst, 'reload schema';
