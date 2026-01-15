-- Update the role of the specified user to 'owner'
-- This grants full access bypass in the application
UPDATE public.profiles
SET role = 'owner'
WHERE id IN (
    SELECT id 
    FROM auth.users 
    WHERE email = 'rhpetshop25@gmail.com'
);

-- Verify the update
SELECT * FROM public.profiles 
WHERE id IN (
    SELECT id 
    FROM auth.users 
    WHERE email = 'rhpetshop25@gmail.com'
);
