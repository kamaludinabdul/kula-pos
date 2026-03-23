-- =====================================================================================
-- KASIR PRO SUPABASE - DOCTOR COMMISSIONS & MEDICAL RECORD STATUS
-- =====================================================================================

BEGIN;

-- 1. Update Products table for Doctor Commissions
DO $$ BEGIN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS doctor_fee_type TEXT DEFAULT 'fixed';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS doctor_fee_value NUMERIC DEFAULT 0;
END $$;

-- 2. Update Pet Services table for Doctor Commissions
DO $$ BEGIN
    ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS doctor_fee_type TEXT DEFAULT 'fixed';
    ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS doctor_fee_value NUMERIC DEFAULT 0;
END $$;

-- 3. Update Medical Records for POS Checkout Status
DO $$ BEGIN
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS is_paid_pos BOOLEAN DEFAULT false;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
