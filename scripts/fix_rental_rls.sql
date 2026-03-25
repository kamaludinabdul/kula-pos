-- =====================================================================================
-- FIX RLS POLICIES FOR RENTAL & INVENTORY TABLES
-- Menambal policy RLS yang luput untuk hak akses Owner dan Kasir melakukan INSERT/UPDATE
-- =====================================================================================

DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY['rental_units', 'rental_sessions', 'stock_movements', 'batches'];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables LOOP 
        -- Pastikan RLS diaktifkan
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl_name);
        
        -- Hapus policy lama jika ada untuk mencegah duplikasi (conflict)
        EXECUTE format('DROP POLICY IF EXISTS multitenant_%I_policy ON public.%I;', tbl_name, tbl_name);
        EXECUTE format('DROP POLICY IF EXISTS "Store members can access %I" ON public.%I;', tbl_name, tbl_name);
        
        -- Buat policy multi-tenant super tangguh (Mencakup INSERT, SELECT, UPDATE, DELETE)
        EXECUTE format('
            CREATE POLICY multitenant_%I_policy ON public.%I
            FOR ALL USING (
                auth.uid() IN (SELECT id FROM profiles WHERE role = ''super_admin'') 
                OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
                OR store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
            ) WITH CHECK (
                auth.uid() IN (SELECT id FROM profiles WHERE role = ''super_admin'') 
                OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
                OR store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
            );', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;
