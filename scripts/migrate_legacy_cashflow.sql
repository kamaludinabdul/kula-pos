
-- Migration to Standardize Cash Flow Categories
-- Updates legacy 'Penjualan' entries to standard 'Penjualan (Rekap)'
-- This ensures 'Tutup Buku' works consistently for all past data.

BEGIN;

-- 1. Identify rows to update (Visual Check only, run SELECT manually if needed)
-- SELECT count(*) FROM cash_flow WHERE category = 'Penjualan' AND store_id IS NOT NULL;

-- 2. Update 'Penjualan' -> 'Penjualan (Rekap)'
UPDATE cash_flow
SET category = 'Penjualan (Rekap)'
WHERE category = 'Penjualan';

-- 3. (Optional) Check for duplicates after update?
-- If duplicates exist (e.g., both 'Penjualan' and 'Penjualan (Rekap)' for same date), 
-- we typically keep the latest one or sum them. 
-- For now, simple renaming is safer. If duplicates exist, they will be visible and can be deleted manually.

COMMIT;
