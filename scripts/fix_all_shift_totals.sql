-- ============================================================
-- FIX ALL SHIFT TOTALS - Recalculate from transactions table
-- ============================================================
-- Problem: total_sales, total_cash_sales, total_non_cash_sales
-- in the shifts table were doubled due to accumulation bugs.
--
-- Solution: Recalculate ALL shift totals from the ground truth
-- (transactions table) and overwrite the incorrect values.
-- ============================================================

BEGIN;

UPDATE shifts s SET
    total_sales = COALESCE(tx.real_total, 0),
    total_cash_sales = COALESCE(tx.real_cash, 0),
    total_non_cash_sales = COALESCE(tx.real_non_cash, 0),
    total_discount = COALESCE(tx.real_discount, 0)
FROM (
    SELECT 
        t.shift_id,
        SUM(CASE WHEN t.status = 'completed' THEN t.total ELSE 0 END) as real_total,
        SUM(CASE WHEN t.status = 'completed' AND t.payment_method = 'cash' THEN t.total 
             WHEN t.status = 'completed' AND t.payment_method = 'split' AND t.payment_details->>'method1' = 'cash' THEN (t.payment_details->>'amount1')::NUMERIC
             WHEN t.status = 'completed' AND t.payment_method = 'split' AND t.payment_details->>'method2' = 'cash' THEN (t.payment_details->>'amount2')::NUMERIC
             ELSE 0 END) as real_cash,
        SUM(CASE WHEN t.status = 'completed' AND t.payment_method != 'cash' AND t.payment_method != 'split' THEN t.total
             WHEN t.status = 'completed' AND t.payment_method = 'split' THEN 
                (CASE WHEN t.payment_details->>'method1' != 'cash' THEN (t.payment_details->>'amount1')::NUMERIC ELSE 0 END) +
                (CASE WHEN t.payment_details->>'method2' != 'cash' THEN (t.payment_details->>'amount2')::NUMERIC ELSE 0 END)
             ELSE 0 END) as real_non_cash,
        SUM(CASE WHEN t.status = 'completed' THEN COALESCE(t.discount, 0) ELSE 0 END) as real_discount
    FROM transactions t
    WHERE t.shift_id IS NOT NULL
    GROUP BY t.shift_id
) tx
WHERE s.id = tx.shift_id;

-- Also fix shifts that have NO transactions but show totals (orphaned data)
UPDATE shifts SET
    total_sales = 0,
    total_cash_sales = 0,
    total_non_cash_sales = 0,
    total_discount = 0
WHERE id NOT IN (
    SELECT DISTINCT shift_id FROM transactions WHERE shift_id IS NOT NULL
) AND COALESCE(total_sales, 0) > 0;

COMMIT;

-- Verify results
SELECT 
    s.id,
    s.start_time::date as tanggal,
    s.cashier_name,
    s.total_sales as "Penjualan (Fixed)",
    s.total_cash_sales as "Tunai (Fixed)", 
    s.total_non_cash_sales as "Non-Tunai (Fixed)",
    (SELECT COUNT(*) FROM transactions t WHERE t.shift_id = s.id AND t.status = 'completed') as "Jumlah Transaksi"
FROM shifts s
ORDER BY s.created_at DESC
LIMIT 10;
