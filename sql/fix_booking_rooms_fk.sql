-- Fix missing foreign key relationship between pet_bookings and pet_rooms
-- This allows Supabase (PostgREST) to perform joins like .select('*, pet_rooms(name)')

DO $$ 
BEGIN
    -- Add the foreign key if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'pet_bookings_room_id_fkey' 
        AND table_name = 'pet_bookings'
    ) THEN
        ALTER TABLE public.pet_bookings 
        ADD CONSTRAINT pet_bookings_room_id_fkey 
        FOREIGN KEY (room_id) 
        REFERENCES public.pet_rooms(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Also ensure doctor_id in medical_records has a reference if it doesn't already
-- (Optional but good for schema integrity)
-- ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.staffs(id);

NOTIFY pgrst, 'reload schema';
