-- Script Lengkap: Membuat Tabel ai_insights & Memperbaiki RLS

BEGIN;

-- 1. Buat Tabel ai_insights (Jika belum ada)
CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('yearly', 'monthly')),
    period_year INT NOT NULL,
    period_month INT NOT NULL, -- 0-11 for monthly, -1 for yearly
    insight_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tambahkan constraints unik (Mencegah data ganda)
ALTER TABLE public.ai_insights 
DROP CONSTRAINT IF EXISTS unique_store_period;

ALTER TABLE public.ai_insights 
ADD CONSTRAINT unique_store_period UNIQUE (store_id, period_type, period_year, period_month);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- 4. Hapus Policy Lama (Untuk berjaga-jaga jika ada versi lama yang salah)
DROP POLICY IF EXISTS "multitenant_ai_insights_policy" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can view AI insights for their stores" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can insert AI insights for their stores" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can update AI insights for their stores" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can manage ai insights for their stores" ON public.ai_insights;

-- 5. Buat Kebijakan RLS Baru (Menggunakan tabel profiles)
CREATE POLICY "ai_insights_select_policy"
    ON public.ai_insights FOR SELECT
    USING (
      store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "ai_insights_insert_policy"
    ON public.ai_insights FOR INSERT
    WITH CHECK (
      store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "ai_insights_update_policy"
    ON public.ai_insights FOR UPDATE
    USING (
      store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    )
    WITH CHECK (
      store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );

-- Selesai
COMMIT;
