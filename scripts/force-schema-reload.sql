-- FORCE SCHEMA RELOAD & COLUMN ADDITION
-- Run this if columns seem to be ignored by the API

-- 1. Explicitly ensure columns exist (Idempotent)
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS logo TEXT,
ADD COLUMN IF NOT EXISTS latitude TEXT,
ADD COLUMN IF NOT EXISTS longitude TEXT;

-- 2. Force PostgREST Header (Sometimes helps with caching)
COMMENT ON TABLE public.stores IS 'Storage for store profiles and settings';

-- 3. Reload Schema Cache
-- This command tells Supabase/PostgREST to refresh its knowledge of the DB structure
NOTIFY pgrst, 'reload schema';

DO $$ 
BEGIN
    RAISE NOTICE 'Schema reload triggered. Columns verified.';
END $$;
