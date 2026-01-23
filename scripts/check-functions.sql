-- Check for all versions of get_store_initial_snapshot
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    t.typname as return_type,
    p.prosecdef as security_definer
FROM pg_proc p
JOIN pg_type t ON p.prorettype = t.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'get_store_initial_snapshot';

-- Check for all versions of get_my_store_id
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    t.typname as return_type
FROM pg_proc p
JOIN pg_type t ON p.prorettype = t.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'get_my_store_id';
