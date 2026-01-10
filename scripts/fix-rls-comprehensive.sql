-- Comprehensive Security Fix for Supabase RLS
-- Addresses missing RLS and Security Definer Views

-- 1. Enable RLS on ALL public tables
-- This ensures that even if we forgot to enable RLS on new tables, it will be enabled now.
DO $$ 
DECLARE 
    tbl RECORD;
BEGIN 
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
    LOOP 
        EXECUTE 'ALTER TABLE ' || quote_ident(tbl.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

-- 2. Apply Multitenant Policies to missing tables
-- These tables were enabled but their multitenant policies might be missing or need re-assertion.
DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY['pets', 'medical_records', 'rooms'];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables 
    LOOP 
        EXECUTE format('
            DROP POLICY IF EXISTS multitenant_%I_policy ON %I;
            CREATE POLICY multitenant_%I_policy ON %I
            FOR ALL USING (
                is_super_admin() OR store_id = get_my_store_id()
            ) WITH CHECK (
                is_super_admin() OR store_id = get_my_store_id()
            );', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;

-- 3. Special handling for subscription_plans (Public Read, Super Admin Write)
DROP POLICY IF EXISTS "Enable read access for all users" ON subscription_plans;
CREATE POLICY "Enable read access for all users" ON subscription_plans
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable write access for super_admins" ON subscription_plans;
CREATE POLICY "Enable write access for super_admins" ON subscription_plans
FOR ALL USING (is_super_admin());

-- 4. Fix Security Definer Views
-- Recreating views or altering them to SECURITY INVOKER ensures they respect RLS.

-- v_low_stock_alerts
DROP VIEW IF EXISTS v_low_stock_alerts;
CREATE VIEW v_low_stock_alerts WITH (security_invoker = on) AS
SELECT 
    p.id,
    p.store_id,
    p.name,
    p.stock,
    p.min_stock
FROM products p
WHERE p.is_deleted = false 
  AND p.stock <= p.min_stock 
  AND p.min_stock > 0;

-- product_sales_analytics (Attempt to alter property if Postgres 15+)
-- If the view was created manually, this is the easiest fix.
ALTER VIEW IF EXISTS product_sales_analytics SET (security_invoker = on);
ALTER VIEW IF EXISTS v_low_stock_alerts SET (security_invoker = on);

-- 6. Harden RPC Functions (Fixing Search Path Mutable warning)
ALTER FUNCTION public.get_store_initial_snapshot(UUID) SET search_path = public;
ALTER FUNCTION public.get_profit_loss_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public;
ALTER FUNCTION public.get_product_sales_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public;
ALTER FUNCTION public.reset_loyalty_points(UUID) SET search_path = public;
ALTER FUNCTION public.get_sales_person_ranking(UUID, TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public;
ALTER FUNCTION public.get_my_store_id() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.process_sale(UUID, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, UUID, JSONB, NUMERIC, UUID, TIMESTAMPTZ, NUMERIC) SET search_path = public;
ALTER FUNCTION public.void_transaction(UUID, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.recalculate_product_stats(UUID) SET search_path = public;
ALTER FUNCTION public.bulk_add_products(UUID, JSONB) SET search_path = public;
ALTER FUNCTION public.bulk_update_stock(UUID, JSONB) SET search_path = public;
ALTER FUNCTION public.process_opname_session(UUID, TEXT, JSONB) SET search_path = public;
ALTER FUNCTION public.process_debt_payment(UUID, TEXT, NUMERIC, TEXT, TIMESTAMPTZ) SET search_path = public;
ALTER FUNCTION public.get_shift_summary(UUID, UUID) SET search_path = public;
ALTER FUNCTION public.is_super_admin() SET search_path = public;

-- Verify
DO $$ 
BEGIN
    RAISE NOTICE 'Security hardening applied successfully.';
END $$;
