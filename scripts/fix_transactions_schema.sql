-- Fix Transactions Schema Mismatch and Void RPC
-- This aligns the table with the expectations of void_transaction function

BEGIN;

-- 1. Add missing columns to transactions
DO $$ BEGIN
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS void_by TEXT;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error adding columns to transactions';
END $$;

-- 2. Harden void_transaction to be SECURITY DEFINER
-- This allows bypassing RLS on products/movements during reversal
DO $$ BEGIN
    ALTER FUNCTION public.void_transaction(UUID, TEXT, TEXT, TEXT) SECURITY DEFINER SET search_path = public;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not set SECURITY DEFINER on void_transaction';
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
