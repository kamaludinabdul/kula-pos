-- Recover orphaned transactions by linking them to the correct shifts
-- This fixes the missing sales in reports for the last 2 days

BEGIN;

-- 1. Link orphaned transactions to shifts based on store_id and date
-- We match transactions.date to be between shift.start_time and shift.end_time
-- If end_time is null, we assume the shift is still active or was the latest one
UPDATE transactions t
SET shift_id = s.id
FROM shifts s
WHERE t.shift_id IS NULL
  AND t.store_id = s.store_id
  AND t.date >= s.start_time
  AND (t.date <= s.end_time OR s.end_time IS NULL)
  AND t.status IN ('completed', 'paid');

-- 2. Recalculate shift totals for all affected shifts
-- This ensures the 'shifts' table has the correct aggregate values for reports
UPDATE shifts s
SET 
    total_sales = COALESCE(tx_summary.total_sales, 0),
    total_discount = COALESCE(tx_summary.total_discount, 0),
    total_cash_sales = COALESCE(tx_summary.total_cash_sales, 0),
    total_non_cash_sales = COALESCE(tx_summary.total_non_cash_sales, 0)
FROM (
    SELECT 
        t.shift_id,
        SUM(CASE WHEN t.status IN ('completed', 'paid') THEN t.total ELSE 0 END) as total_sales,
        SUM(CASE WHEN t.status IN ('completed', 'paid') THEN COALESCE(t.discount, 0) ELSE 0 END) as total_discount,
        SUM(CASE WHEN t.status IN ('completed', 'paid') AND t.payment_method = 'cash' THEN t.total ELSE 0 END) as total_cash_sales,
        SUM(CASE WHEN t.status IN ('completed', 'paid') AND (t.payment_method != 'cash' AND t.payment_method != 'split') THEN t.total ELSE 0 END) +
        SUM(CASE 
            WHEN t.status IN ('completed', 'paid') AND t.payment_method = 'split' THEN 
                (CASE WHEN t.payment_details->>'method1' != 'cash' THEN (t.payment_details->>'amount1')::NUMERIC ELSE 0 END) +
                (CASE WHEN t.payment_details->>'method2' != 'cash' THEN (t.payment_details->>'amount2')::NUMERIC ELSE 0 END)
            ELSE 0 
        END) as total_non_cash_sales
    FROM transactions t
    WHERE t.shift_id IS NOT NULL
    GROUP BY t.shift_id
) tx_summary
WHERE s.id = tx_summary.shift_id;

-- 3. Final verification of orphans remaining
SELECT count(*) as remaining_orphans 
FROM transactions 
WHERE shift_id IS NULL 
  AND status IN ('completed', 'paid')
  AND date > now() - interval '3 days';

COMMIT;
