-- Add missing columns to audit_logs table for Login History feature
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user_role TEXT,
ADD COLUMN IF NOT EXISTS store_name TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Update RLS policies to ensure proper access
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.audit_logs;
CREATE POLICY "Enable insert for authenticated users"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.audit_logs;
CREATE POLICY "Enable select for authenticated users"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);
