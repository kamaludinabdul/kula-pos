-- =====================================================================================
-- KASIR PRO SUPABASE - FIX MISSING COLUMNS IN PETS TABLE
-- =====================================================================================
-- This script adds missing columns to the 'pets' table to align with DataContext.jsx.
-- =====================================================================================

BEGIN;

-- Add missing columns to public.pets if they don't exist
DO $$ 
BEGIN
    -- image_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='image_url') THEN
        ALTER TABLE public.pets ADD COLUMN image_url TEXT;
    END IF;

    -- rm_number (frontend uses this instead of medical_record_number)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='rm_number') THEN
        ALTER TABLE public.pets ADD COLUMN rm_number TEXT;
    END IF;

    -- pet_type (frontend uses this instead of type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='pet_type') THEN
        ALTER TABLE public.pets ADD COLUMN pet_type TEXT;
    END IF;

    -- pet_age (frontend uses TEXT for age description, while SQL had birth_date)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='pet_age') THEN
        ALTER TABLE public.pets ADD COLUMN pet_age TEXT;
    END IF;

    -- special_needs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='special_needs') THEN
        ALTER TABLE public.pets ADD COLUMN special_needs TEXT;
    END IF;

    -- medical_history
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='medical_history') THEN
        ALTER TABLE public.pets ADD COLUMN medical_history TEXT;
    END IF;
    
    -- Sync existing data for consistency
    -- 1. RM Number
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='medical_record_number') THEN
        UPDATE public.pets SET rm_number = medical_record_number WHERE rm_number IS NULL AND medical_record_number IS NOT NULL;
    END IF;

    -- 2. Pet Type
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='type') THEN
        UPDATE public.pets SET pet_type = type WHERE pet_type IS NULL AND type IS NOT NULL;
    END IF;
    
    -- 3. Notes to Special Needs (if applicable)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='notes') THEN
        UPDATE public.pets SET special_needs = notes WHERE special_needs IS NULL AND notes IS NOT NULL;
    END IF;
END $$;

COMMIT;

-- Reload schema for PostgREST
NOTIFY pgrst, 'reload schema';
