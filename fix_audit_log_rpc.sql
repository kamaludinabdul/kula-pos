-- Create a function that runs with elevated privileges (SECURITY DEFINER)
-- This allows the client to insert audit logs without getting blocked by RLS
CREATE OR REPLACE FUNCTION insert_audit_log(
    p_user_id UUID,
    p_action TEXT,
    p_status TEXT,
    p_user_name TEXT,
    p_user_role TEXT,
    p_store_id UUID,
    p_store_name TEXT,
    p_user_agent TEXT,
    p_metadata JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.audit_logs (
        user_id, action, status, user_name, user_role, store_id, store_name, user_agent, metadata
    ) VALUES (
        p_user_id, p_action, p_status, p_user_name, p_user_role, p_store_id, p_store_name, p_user_agent, p_metadata
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION insert_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION insert_audit_log TO anon;
