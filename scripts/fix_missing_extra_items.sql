-- =====================================================================================
-- KASIR PRO SUPABASE - ADD EXTRA_ITEMS TO PET_BOOKINGS
-- =====================================================================================
-- This script adds the extra_items column to the pet_bookings table and reloads schema.
-- =====================================================================================

BEGIN;

-- 1. Add extra_items column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pet_bookings' AND column_name='extra_items') THEN
        ALTER TABLE public.pet_bookings ADD COLUMN extra_items JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

COMMIT;

-- 2. Reload schema for PostgREST (Optional nudge)
NOTIFY pgrst, 'reload schema';
