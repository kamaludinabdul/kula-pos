-- Create debug_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id BIGSERIAL PRIMARY KEY,
    location TEXT,
    error_message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions
GRANT ALL ON public.debug_logs TO postgres;
GRANT ALL ON public.debug_logs TO service_role;
GRANT INSERT ON public.debug_logs TO authenticated;
GRANT INSERT ON public.debug_logs TO anon;
