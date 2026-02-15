-- 1. Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add missing columns for Login History feature (idempotent)
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user_role TEXT,
ADD COLUMN IF NOT EXISTS store_name TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 3. Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Update RLS policies to ensure proper access
-- Allow insert for authenticated users
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.audit_logs;
CREATE POLICY "Enable insert for authenticated users"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow select for authenticated users (required for Login History page)
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.audit_logs;
CREATE POLICY "Enable select for authenticated users"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_store_id ON public.audit_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
