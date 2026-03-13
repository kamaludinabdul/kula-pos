-- Diagnose: Which store_id do the leaked staff have?
-- Run this in Supabase SQL Editor

-- 1. Check fathulmuin's profile store_id
SELECT 'FATHULMUIN PROFILE' as label, id, email, store_id, role, plan
FROM profiles WHERE email = 'fathulmuin@gmail.com';

-- 2. Check fathulmuin's stores (as owner)
SELECT 'FATHULMUIN STORES' as label, id, name, owner_id, plan
FROM stores WHERE owner_id = (SELECT id FROM profiles WHERE email = 'fathulmuin@gmail.com');

-- 3. Check the leaked staff - what store_id do they have?
SELECT 'LEAKED STAFF' as label, p.email, p.name, p.store_id, p.role,
       s.name as store_name, s.owner_id,
       owner_profile.email as store_owner_email
FROM profiles p
LEFT JOIN stores s ON s.id = p.store_id
LEFT JOIN profiles owner_profile ON owner_profile.id = s.owner_id
WHERE p.email IN ('anggreinyrini89@gmail.com', 'akbarfams', 'salesrh@gmail.com', 'kamaludin.abdul@shipper.id')
   OR p.name IN ('Ria Anggreiny', 'Akbar', 'Sales RH', 'Kamal');

-- 4. All profiles pointing to fathulmuin's store
SELECT 'ALL IN FATHULMUIN STORE' as label, p.email, p.name, p.role
FROM profiles p
WHERE p.store_id = (
    SELECT id FROM stores WHERE owner_id = (SELECT id FROM profiles WHERE email = 'fathulmuin@gmail.com') LIMIT 1
);
