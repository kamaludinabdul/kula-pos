-- =====================================================================================
-- KASIR PRO SUPABASE - FIX PET_BOOKINGS FOREIGN KEY CONSTRAINT
-- =====================================================================================
-- This script removes the strict foreign key constraint from pet_bookings.service_id.
-- This is necessary because "Hotel" bookings use IDs from the 'products' table,
-- while other bookings (grooming, medical) use IDs from 'pet_services' table.
-- =====================================================================================

BEGIN;

-- 1. Identify and drop the foreign key constraint if it exists
-- The constraint name is usually 'pet_bookings_service_id_fkey' based on the error message.
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'pet_bookings_service_id_fkey' 
        AND table_name = 'pet_bookings'
    ) THEN
        ALTER TABLE public.pet_bookings DROP CONSTRAINT pet_bookings_service_id_fkey;
    END IF;
END $$;

COMMIT;

-- 2. Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
