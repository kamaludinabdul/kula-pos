-- =========================================================
-- ADD MISSING LOGO COLUMN TO STORES TABLE
-- =========================================================
-- This column is missing in production but exists in scripts.
-- Logo uploads fail to persist because the column doesn't exist.
-- =========================================================

-- 1. Add the logo column if it doesn't exist
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS logo TEXT;

-- 2. Also add other potentially missing profile columns
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS receipt_header TEXT,
ADD COLUMN IF NOT EXISTS receipt_footer TEXT,
ADD COLUMN IF NOT EXISTS printer_paper_size TEXT DEFAULT '58mm';

-- 3. Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stores' AND column_name IN ('logo', 'receipt_header', 'receipt_footer', 'printer_paper_size');

-- 4. Refresh schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

SELECT 'Logo column added successfully!' as status;
