-- Nuke and Pave: Reset audit_logs table cleanly
DROP TABLE IF EXISTS public.audit_logs;

CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert logs (broad permission for logging)
CREATE POLICY "Enable insert for authenticated users"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow viewing logs
CREATE POLICY "Enable select for authenticated users"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);
