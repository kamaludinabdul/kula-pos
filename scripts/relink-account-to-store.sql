-- Link Account to Correct Store
-- This script will move rhpetshop25@gmail.com to the store that actually has the products.
-- Target Store: b5b56789-1960-7bd0-1f54-abee9db1ee37 (547 products)

BEGIN;

-- 1. Identify valid store
-- We already know b5b56789-1960-7bd0-1f54-abee9db1ee37 has the data.

-- 2. Update the profile
UPDATE public.profiles
SET store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid
WHERE email = 'rhpetshop25@gmail.com';

-- 3. Also ensure any other related user data is consistent if needed
-- (Usually store_id in profile is the main anchor)

COMMIT;

-- Verify
SELECT email, store_id, (SELECT name FROM stores WHERE id = store_id) as store_name
FROM profiles
WHERE email = 'rhpetshop25@gmail.com';
