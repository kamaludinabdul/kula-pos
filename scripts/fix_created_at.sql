-- Fix NULL created_at issue for imported transactions
-- This will make them visible in the app's date filter

-- Update all transactions where created_at is NULL
-- Set created_at = date to match the intended transaction date
UPDATE public.transactions
SET created_at = date
WHERE created_at IS NULL
  AND store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid;

-- Verify the fix
SELECT id, created_at, date, total 
FROM transactions 
WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid
ORDER BY created_at DESC
LIMIT 10;
