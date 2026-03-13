-- CEK ANOMALI DATA UNTUK kasirfamspet@gmail.com
-- Jalankan skrip ini, lalu lihat hasilnya di tab "Results"

SELECT 'Profile ID' as keterangan, id::text as nilai FROM public.profiles WHERE email = 'kasirfamspet@gmail.com'
UNION ALL
SELECT 'Store ID in Profile' as keterangan, COALESCE(store_id::text, 'NULL') FROM public.profiles WHERE email = 'kasirfamspet@gmail.com'
UNION ALL
SELECT 'Store ID' as keterangan, COALESCE(id::text, 'NULL') FROM public.stores WHERE email = 'kasirfamspet@gmail.com'
UNION ALL
SELECT 'Store Owner ID' as keterangan, COALESCE(owner_id::text, 'NULL') FROM public.stores WHERE email = 'kasirfamspet@gmail.com'
UNION ALL
SELECT 'Store Name' as keterangan, name FROM public.stores WHERE email = 'kasirfamspet@gmail.com'
UNION ALL
SELECT 'Store Status (is_deleted?)' as keterangan, 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='stores' AND column_name='is_deleted'
    ) THEN 'Kolom is_deleted ada' ELSE 'Tidak ada kolom is_deleted' END;
