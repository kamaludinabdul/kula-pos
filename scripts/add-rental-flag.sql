-- Add enable_rental column to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS enable_rental BOOLEAN DEFAULT FALSE;

-- Update RLS policies is not needed as they usually cover ALL columns if using (store_id = get_my_store_id())
-- But let's verify if there are any specific column-level restrictions (rare in this setup)
