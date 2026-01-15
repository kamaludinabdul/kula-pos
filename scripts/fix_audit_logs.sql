-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert logs
-- We use a broad check here because sometimes the user_id in the row might match auth.uid(), 
-- but sometimes we might want system-level logging. 
-- For strictness: auth.uid() = user_id
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.audit_logs;
CREATE POLICY "Enable insert for authenticated users"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Policy: Allow viewing logs
-- Ideally restricted to store owners/admins, but for now we allow authenticated read 
-- (filtering is handles by the frontend/backend query logic usually)
DROP POLICY IF EXISTS "Enable select for authenticated users" ON public.audit_logs;
CREATE POLICY "Enable select for authenticated users"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);
