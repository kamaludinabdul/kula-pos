-- Check ALL versions of get_dashboard_stats that exist in the database
SELECT 
    n.nspname as schema,
    p.proname as function_name, 
    pg_get_function_arguments(p.oid) as arguments,
    p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('get_dashboard_stats', 'get_store_initial_snapshot', 'get_products_page', 'get_dashboard_monthly_summary')
ORDER BY p.proname;
