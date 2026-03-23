-- =====================================================================================
-- KASIR PRO SUPABASE - PET SHOP PHASE 6: PREMIUM FEATURES
-- =====================================================================================

BEGIN;

-- 1. DAILY ACTIVITY LOGS
-- =====================================================================================
CREATE TABLE IF NOT EXISTS public.pet_daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.pet_bookings(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    eating TEXT, -- lahap, sisa_sedikit, sisa_banyak, tidak_makan
    mood TEXT, -- ceria, tenang, takut, agresif, lemas
    bathroom TEXT, -- normal, lembek, keras, tidak_ada
    notes TEXT,
    staff_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INDEXES
-- =====================================================================================
CREATE INDEX IF NOT EXISTS idx_pet_daily_logs_booking_id ON public.pet_daily_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_pet_daily_logs_pet_id ON public.pet_daily_logs(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_daily_logs_store_id ON public.pet_daily_logs(store_id);

-- 3. SECURITY (RLS Policies)
-- =====================================================================================
ALTER TABLE public.pet_daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS multitenant_pet_daily_logs_policy ON public.pet_daily_logs;
CREATE POLICY multitenant_pet_daily_logs_policy ON public.pet_daily_logs
FOR ALL USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin') 
    OR store_id = get_my_store_id()
) WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin') 
    OR store_id = get_my_store_id()
);

COMMIT;

NOTIFY pgrst, 'reload schema';
