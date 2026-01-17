-- CHECK POLICIES AND PERFORMANCE
-- Run this in SQL Editor

-- 1. Check all policies on profiles and stores
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename IN ('profiles', 'stores');

-- 2. Check table sizes
SELECT 
    relname as table_name, 
    n_live_tup as row_count 
FROM pg_stat_user_tables 
WHERE relname IN ('profiles', 'stores', 'products', 'transactions');

-- 3. Check for long running queries or locks
SELECT 
    pid, 
    now() - xact_start AS duration, 
    query, 
    state 
FROM pg_stat_activity 
WHERE (now() - xact_start) > interval '5 seconds'
AND state != 'idle';
