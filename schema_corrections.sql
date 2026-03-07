-- SCHEMA CORRECTIONS
-- 1. Add missing image_url to categories for master snapshot RPC
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Ensure store_id exists in loyalty_history for RLS
ALTER TABLE public.loyalty_history ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- 3. Reload schema cache
NOTIFY pgrst, 'reload schema';
