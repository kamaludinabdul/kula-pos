-- Fix Transactions RLS Policy Error
-- Run this in Supabase SQL Editor

BEGIN;

-- 1. Reinforce is_super_admin() function
-- Ensure it is SECURITY DEFINER and has a fixed search_path
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Explicitly Fix Transactions RLS
-- Drop the broad policy and replace with granular ones for clarity and robustness
DROP POLICY IF EXISTS multitenant_transactions_policy ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_policy" ON public.transactions;

-- SELECT Policy
CREATE POLICY "transactions_select_policy" ON public.transactions
FOR SELECT TO authenticated
USING (
    store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_super_admin()
);

-- INSERT Policy (Crucial for Checkout)
CREATE POLICY "transactions_insert_policy" ON public.transactions
FOR INSERT TO authenticated
WITH CHECK (
    store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_super_admin()
);

-- UPDATE Policy
CREATE POLICY "transactions_update_policy" ON public.transactions
FOR UPDATE TO authenticated
USING (
    store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_super_admin()
)
WITH CHECK (
    store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
    OR public.is_super_admin()
);

-- 3. Harden process_sale search_path
DO $$ BEGIN
    ALTER FUNCTION public.process_sale SET search_path = public;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Function public.process_sale not found or error setting search_path';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
