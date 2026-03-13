-- SCRIPT PEMBERSIHAN TOKO DUPLIKAT (kasirfamspet@gmail.com)
-- Jalankan ini di Supabase SQL Editor untuk menyisakan 1 toko yang benar.

DO $$
DECLARE
    v_profile_store_id UUID;
    v_user_email TEXT := 'kasirfamspet@gmail.com';
    v_user_id UUID;
BEGIN
    -- 1. Dapatkan ID asli dari auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User tidak ditemukan di auth.users!';
        RETURN;
    END IF;

    -- 2. Dapatkan Store ID yang saat ini terhubung ke Profile
    SELECT store_id INTO v_profile_store_id FROM public.profiles WHERE id = v_user_id LIMIT 1;

    IF v_profile_store_id IS NOT NULL THEN
        -- 3. Hapus semua toko milik user ini KECUALI yang terhubung ke profile
        DELETE FROM public.stores 
        WHERE owner_id = v_user_id AND id != v_profile_store_id;
        
        RAISE NOTICE 'BERHASIL: Toko duplikat telah dihapus. Toko utama yang dipertahankan: %', v_profile_store_id;
    ELSE
        RAISE NOTICE 'GAGAL: Profil tidak memiliki store_id yang valid.';
    END IF;
END $$;
