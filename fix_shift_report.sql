-- =============================================================================
-- FIX: Shift Report Anomaly (Double-Counted Sales)
-- =============================================================================
-- MASALAH: shifts.total_sales, total_cash_sales, total_non_cash_sales menunjukkan 
--          nilai yang lebih tinggi dari seharusnya (kemungkinan 2x lipat).
--          Ini menyebabkan perhitungan expected_cash dan cash_difference salah
--          (Selisih = negatif Modal Awal).
--
-- AKAR MASALAH: process_sale() menambahkan total ke shifts.total_sales di SQL,
--               DAN kode frontend (updateShiftStats) juga pernah menambahkan 
--               jumlah yang sama ke shifts.total_sales via Supabase client.
--               updateShiftStats sudah di-disable, tapi data lama masih salah.
--
-- FIX: Hitung ulang SEMUA kolom shift dari tabel transactions (sumber kebenaran).
--      Lalu hitung ulang expected_cash dan cash_difference untuk shift yang sudah ditutup.
-- =============================================================================

BEGIN;

-- ============================================
-- STEP 1: Recalculate shift sales totals from transactions
-- ============================================
UPDATE shifts s
SET 
    total_sales = COALESCE(tx.calc_total_sales, 0),
    total_discount = COALESCE(tx.calc_total_discount, 0),
    total_cash_sales = COALESCE(tx.calc_total_cash_sales, 0),
    total_non_cash_sales = COALESCE(tx.calc_total_non_cash_sales, 0)
FROM (
    SELECT 
        t.shift_id,
        SUM(CASE WHEN t.status = 'completed' THEN t.total ELSE 0 END) as calc_total_sales,
        SUM(CASE WHEN t.status = 'completed' THEN COALESCE(t.discount, 0) ELSE 0 END) as calc_total_discount,
        -- Cash sales: full cash + cash portion of split payments
        SUM(CASE 
            WHEN t.status = 'completed' AND t.payment_method = 'cash' THEN t.total 
            WHEN t.status = 'completed' AND t.payment_method = 'split' AND t.payment_details->>'method1' = 'cash' 
                THEN (t.payment_details->>'amount1')::NUMERIC
            WHEN t.status = 'completed' AND t.payment_method = 'split' AND t.payment_details->>'method2' = 'cash' 
                THEN (t.payment_details->>'amount2')::NUMERIC
            ELSE 0 
        END) as calc_total_cash_sales,
        -- Non-cash sales: non-cash methods + non-cash portion of split payments
        SUM(CASE 
            WHEN t.status = 'completed' AND t.payment_method NOT IN ('cash', 'split') THEN t.total
            WHEN t.status = 'completed' AND t.payment_method = 'split' THEN
                (CASE WHEN t.payment_details->>'method1' != 'cash' THEN (t.payment_details->>'amount1')::NUMERIC ELSE 0 END) +
                (CASE WHEN t.payment_details->>'method2' != 'cash' THEN (t.payment_details->>'amount2')::NUMERIC ELSE 0 END)
            ELSE 0 
        END) as calc_total_non_cash_sales
    FROM transactions t
    WHERE t.shift_id IS NOT NULL
    GROUP BY t.shift_id
) tx
WHERE s.id = tx.shift_id;

-- ============================================
-- STEP 2: Recalculate expected_cash and cash_difference for CLOSED shifts
-- Formula: expected_cash = initial_cash + total_cash_sales + total_cash_in - total_cash_out
--          cash_difference = final_cash - expected_cash
-- ============================================
UPDATE shifts
SET 
    expected_cash = COALESCE(initial_cash, 0) + COALESCE(total_cash_sales, 0) + COALESCE(total_cash_in, 0) - COALESCE(total_cash_out, 0),
    cash_difference = COALESCE(final_cash, 0) - (COALESCE(initial_cash, 0) + COALESCE(total_cash_sales, 0) + COALESCE(total_cash_in, 0) - COALESCE(total_cash_out, 0)),
    expected_non_cash = COALESCE(total_non_cash_sales, 0),
    non_cash_difference = COALESCE(final_non_cash, 0) - COALESCE(total_non_cash_sales, 0)
WHERE status = 'closed';

-- ============================================
-- STEP 3: Verification - Show results
-- ============================================
SELECT 
    s.id as shift_id,
    s.cashier_name,
    s.start_time::date as tanggal,
    s.initial_cash as modal_awal,
    s.total_sales as penjualan,
    s.total_cash_sales as tunai,
    s.total_non_cash_sales as non_tunai,
    s.total_cash_in as kas_masuk,
    s.total_cash_out as kas_keluar,
    s.final_cash as uang_akhir,
    s.expected_cash as ekspektasi,
    s.cash_difference as selisih,
    s.status
FROM shifts s
ORDER BY s.start_time DESC
LIMIT 10;

COMMIT;
