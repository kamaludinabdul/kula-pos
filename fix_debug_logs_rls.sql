-- Enable RLS for debug_logs table to resolve Supabase security warning
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon, authenticated) to insert debug logs
CREATE POLICY "Enable insert for everyone" 
ON public.debug_logs 
FOR INSERT 
WITH CHECK (true);

-- No SELECT, UPDATE, or DELETE policies are created for anon/authenticated.
-- This means only service_role and postgres can read or modify existing logs,
-- keeping the logs secure from public view while allowing client-side error reporting if needed.
