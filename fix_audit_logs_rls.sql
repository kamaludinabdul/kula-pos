-- Drop existing insert policies to prevent duplicates
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_logs;

-- Re-create a broad insert policy for authenticated users 
CREATE POLICY "Enable insert for authenticated users"
ON public.audit_logs
FOR INSERT 
TO authenticated
WITH CHECK (true); -- Anyone authenticated can insert

-- If we want to strictly limit them to inserting their own logs:
-- WITH CHECK (auth.uid() = user_id);
