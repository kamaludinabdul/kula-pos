-- Delete zero-price transactions imported today
-- These are from the failed import attempt

DELETE FROM public.transactions
WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid
  AND total = 0
  AND date >= '2026-01-16'
  AND date < '2026-01-17';

-- Verify deletion
SELECT COUNT(*) as remaining_jan16 
FROM transactions
WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid
  AND date >= '2026-01-16'
  AND date < '2026-01-17';
