-- Delete ghost account kasirfamspet@gmail.com
DO $$
DECLARE
    ghost_id UUID;
BEGIN
    SELECT id INTO ghost_id FROM auth.users WHERE email = 'kasirfamspet@gmail.com';
    IF ghost_id IS NOT NULL THEN
        -- Delete any partial traces just in case
        DELETE FROM public.audit_logs WHERE user_id = ghost_id;
        DELETE FROM public.profiles WHERE id = ghost_id;
        DELETE FROM public.stores WHERE owner_id = ghost_id;
        
        -- Finally delete the actual auth user
        DELETE FROM auth.users WHERE id = ghost_id;
        RAISE NOTICE 'Ghost user % deleted successfully.', ghost_id;
    ELSE
        RAISE NOTICE 'Ghost user kasirfamspet@gmail.com not found in auth.users.';
    END IF;
END $$;
