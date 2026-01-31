-- Run this in Supabase SQL Editor to find your Store ID
SELECT id as user_id, email, store_id 
FROM public.users 
WHERE email = 'rhpetshop25@gmail.com';
