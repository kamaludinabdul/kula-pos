-- Add missing columns to stores table for profile settings
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS logo TEXT,
ADD COLUMN IF NOT EXISTS latitude TEXT,
ADD COLUMN IF NOT EXISTS longitude TEXT;

-- Verify columns (Optional for logging)
DO $$ 
BEGIN
    RAISE NOTICE 'Stores table columns updated successfully.';
END $$;
