-- FIX: AUTO-GENERATE RM NUMBER FOR PETS
-- This script adds a trigger to ensure every pet gets an RM number if not provided.

BEGIN;

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION public.trg_generate_pet_rm()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate if rm_number is null or empty
    IF NEW.rm_number IS NULL OR NEW.rm_number = '' THEN
        NEW.rm_number := public.generate_pet_rm_number(NEW.store_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS trg_before_insert_pet ON public.pets;
CREATE TRIGGER trg_before_insert_pet
BEFORE INSERT ON public.pets
FOR EACH ROW
EXECUTE FUNCTION public.trg_generate_pet_rm();

-- 3. Backfill existing pets that don't have RM numbers
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, store_id FROM public.pets WHERE rm_number IS NULL OR rm_number = '' LOOP
        UPDATE public.pets 
        SET rm_number = public.generate_pet_rm_number(r.store_id)
        WHERE id = r.id;
    END LOOP;
END $$;

COMMIT;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
