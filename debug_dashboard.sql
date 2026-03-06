-- DIAGNOSTIC: Check all versions of get_dashboard_stats in the database
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    p.prosecdef as security_definer,
    l.lanname as language
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('get_dashboard_stats', 'get_owner_dashboard_stats', 'get_profit_loss_report');
