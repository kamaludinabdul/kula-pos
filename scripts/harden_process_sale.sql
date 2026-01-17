-- Harden process_sale RPC 
-- This allows the transaction to bypass granular RLS on stock/customers/movements
-- and execute atomically as the database owner.

BEGIN;

-- 1. Update process_sale to be SECURITY DEFINER
-- This is critical for POS operations involving multiple tables
ALTER FUNCTION public.process_sale(
    UUID, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, UUID, JSONB, NUMERIC, UUID, TIMESTAMPTZ, NUMERIC
) SECURITY DEFINER SET search_path = public;

-- 2. Verify settings
SELECT proname, prosecdef, proconfig 
FROM pg_proc 
WHERE proname = 'process_sale';

COMMIT;

NOTIFY pgrst, 'reload schema';
