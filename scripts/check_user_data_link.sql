-- Diagnose Missing Data for 'rhpetshop25@gmail.com'

-- 1. Check if the user exists in profiles and what store_id they have
SELECT 
    id as user_id, 
    email, 
    role, 
    store_id, 
    name
FROM profiles 
WHERE email = 'rhpetshop25@gmail.com';

-- 2. Check if the store exists (using the ID found above, or searching by email)
-- NOTE: Corrected column name from owner_email to just email or checking owner_id
SELECT 
    id as store_id, 
    name as store_name, 
    email, 
    owner_name,
    status
FROM stores 
WHERE email = 'rhpetshop25@gmail.com';

-- 3. Check if there is a store ID mismatch
-- meaningful only if query 1 returns a store_id
WITH user_profile AS (
    SELECT store_id FROM profiles WHERE email = 'rhpetshop25@gmail.com'
)
SELECT 
    s.id as store_id, 
    s.name, 
    s.status 
FROM stores s, user_profile p
WHERE s.id = p.store_id;
