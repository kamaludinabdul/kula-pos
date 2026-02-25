-- Migration to add pet_care_enabled column to stores table
ALTER TABLE stores 
ADD COLUMN IF NOT EXISTS pet_care_enabled BOOLEAN DEFAULT false;

-- Add comment explaining the column
COMMENT ON COLUMN stores.pet_care_enabled IS 'Toggle to enable/disable Pet Hotel features for this store (Enterprise plan only)';

-- Verify
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='stores' AND column_name='pet_care_enabled'
    ) THEN
        RAISE NOTICE 'Column pet_care_enabled successfully added to stores table.';
    ELSE
        RAISE EXCEPTION 'Failed to add column pet_care_enabled.';
    END IF;
END $$;
