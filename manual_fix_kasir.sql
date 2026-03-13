-- MANUAL FIX & STATUS REPORT for kasirfamspet@gmail.com
-- This script will return a table showing exactly what happened.

WITH user_id_fetch AS (
    SELECT id, email FROM auth.users WHERE email = 'kasirfamspet@gmail.com'
),
profile_fix AS (
    INSERT INTO public.profiles (id, username, name, email, role, status)
    SELECT id, email, 'Kepala Toko', email, 'owner', 'online'
    FROM user_id_fetch
    ON CONFLICT (id) DO UPDATE SET role = 'owner'
    RETURNING id, 'SUCCESS'::text as status
),
store_fix AS (
    INSERT INTO public.stores (name, plan, owner_id, owner_name, email, business_type)
    SELECT 'Apotek Sejahtera', 'pro', id, 'Kepala Toko', 'kasirfamspet@gmail.com', 'pharmacy'
    FROM user_id_fetch
    WHERE NOT EXISTS (SELECT 1 FROM public.stores WHERE email = 'kasirfamspet@gmail.com')
    RETURNING id, 'SUCCESS'::text as status
),
link_fix AS (
    UPDATE public.profiles 
    SET store_id = (SELECT id FROM public.stores WHERE email = 'kasirfamspet@gmail.com' LIMIT 1)
    WHERE email = 'kasirfamspet@gmail.com'
    RETURNING id, 'SUCCESS'::text as status
)
SELECT 
    'User ID' as step, (SELECT id::text FROM user_id_fetch) as result
UNION ALL
SELECT 
    'Profile Status' as step, COALESCE((SELECT status FROM profile_fix), 'ALREADY EXISTS/FAILED') as result
UNION ALL
SELECT 
    'Store Status' as step, COALESCE((SELECT status FROM store_fix), 'ALREADY EXISTS/FAILED') as result
UNION ALL
SELECT 
    'Link Status' as step, COALESCE((SELECT status FROM link_fix), 'SUCCESS') as result;

