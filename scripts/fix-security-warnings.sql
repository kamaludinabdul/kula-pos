-- =============================================================================
-- FIX SUPABASE SECURITY WARNINGS
-- =============================================================================
-- This script fixes two issues:
-- 1. Function Search Path Mutable - Sets search_path on all custom functions
-- 2. RLS Policy Always True - Fixes overly permissive profiles policies
-- =============================================================================

-- 1. FIX FUNCTION SEARCH PATH (Security Best Practice)
-- These functions need SET search_path = public to prevent SQL injection
-- Using DO blocks to safely handle functions that may not exist

DO $$ BEGIN ALTER FUNCTION public.get_my_store_id() SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.handle_new_user() SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.void_transaction(UUID, TEXT) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.recalculate_product_stats(UUID, UUID) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.bulk_add_products(JSONB) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.bulk_update_stock(JSONB) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.process_opname_session(UUID) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.process_debt_payment(UUID, NUMERIC, TEXT) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;
DO $$ BEGIN ALTER FUNCTION public.get_shift_summary(UUID) SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- For process_sale, try multiple common signatures
DO $$ BEGIN ALTER FUNCTION public.process_sale SET search_path = public; EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- 2. FIX OVERLY PERMISSIVE RLS POLICY ON PROFILES
-- Current "Allow all authenticated" policies are too broad
-- We need to restrict to: user can only see/edit their own profile, OR super_admin can see all

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Enable read for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.profiles;

-- Create proper multi-tenant policies
-- SELECT: Users can see their own profile OR profiles in the same store OR super_admin sees all
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (
    id = auth.uid()
    OR store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
    OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
);

-- INSERT: Only super_admin can insert profiles (normal signup uses trigger)
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
    OR id = auth.uid() -- Allow self-insert during signup
);

-- UPDATE: Users can update their own profile, or admin/owner can update store members
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE TO authenticated
USING (
    id = auth.uid()
    OR (
        store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
        AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('owner', 'admin', 'super_admin'))
    )
)
WITH CHECK (
    id = auth.uid()
    OR (
        store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
        AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('owner', 'admin', 'super_admin'))
    )
);

-- DELETE: Only super_admin or owner can delete profiles in their store
CREATE POLICY "profiles_delete_policy" ON public.profiles
FOR DELETE TO authenticated
USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
    OR (
        store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
        AND auth.uid() IN (SELECT id FROM profiles WHERE role IN ('owner', 'admin'))
        AND id != auth.uid() -- Cannot delete self
    )
);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
