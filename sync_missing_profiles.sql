-- Quick fix to sync any missing profiles from auth.users to public.profiles
-- This runs safely and only inserts missing profiles.

INSERT INTO public.profiles (id, email, name, role, status)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)), 
    COALESCE(au.raw_user_meta_data->>'role', 'owner'),
    'offline'
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
