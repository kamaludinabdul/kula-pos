-- Script untuk memperbaiki data shift lama
-- Menghitung ulang total_sales, total_cash_sales, dan total_non_cash_sales
-- berdasarkan data transaksi yang sudah ada

-- 0. Tambahkan kolom yang mungkin belum ada
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_sales NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_cash_sales NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_non_cash_sales NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_discount NUMERIC(15, 2) DEFAULT 0;

-- 1. Update semua shift yang sudah selesai dengan data dari transactions
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
        SUM(CASE WHEN t.status IN ('completed', 'paid') AND t.payment_method != 'cash' THEN t.total ELSE 0 END) as total_non_cash_sales
    FROM transactions t
    WHERE t.shift_id IS NOT NULL
    GROUP BY t.shift_id
) tx_summary
WHERE s.id = tx_summary.shift_id;

-- 2. Tampilkan hasil verifikasi
SELECT 
    s.id,
    s.cashier_name,
    s.start_time,
    s.total_sales,
    s.total_cash_sales,
    s.total_non_cash_sales,
    s.final_cash,
    s.status
FROM shifts s
ORDER BY s.start_time DESC
LIMIT 10;
