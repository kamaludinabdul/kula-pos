-- Check the last 10 audit logs regardless of permissions (if run by admin/editor)
SELECT 
    id, 
    created_at, 
    user_name, 
    action, 
    status, 
    store_id 
FROM 
    audit_logs 
ORDER BY 
    created_at DESC 
LIMIT 10;
