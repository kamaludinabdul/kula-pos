
CREATE OR REPLACE FUNCTION public.debug_fn() RETURNS JSONB
LANGUAGE plpgsql AS $$
BEGIN
    RETURN (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'get_owner_dashboard_stats' LIMIT 1);
END;
$$;
