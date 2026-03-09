-- Script untuk Phase 1: Menambahkan table columns untuk Modul Apotek

-- ==========================================
-- 1. Update tabel `products`
-- ==========================================
ALTER TABLE "public"."products"
ADD COLUMN IF NOT EXISTS "is_prescription_required" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "is_racikan" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "units" JSONB;

-- Comment for developer reference:
-- format jsonb units:
-- [
--   { "name": "Tablet", "multiplier": 1, "barcode": "111", "price": 1000 },
--   { "name": "Strip", "multiplier": 10, "barcode": "222", "price": 9500 },
--   { "name": "Box", "multiplier": 100, "barcode": "333", "price": 90000 }
-- ]

-- ==========================================
-- 2. Update tabel `transactions`
-- ==========================================
ALTER TABLE "public"."transactions"
ADD COLUMN IF NOT EXISTS "patient_name" TEXT,
ADD COLUMN IF NOT EXISTS "doctor_name" TEXT,
ADD COLUMN IF NOT EXISTS "prescription_number" TEXT,
ADD COLUMN IF NOT EXISTS "tuslah_fee" NUMERIC DEFAULT 0;

-- Optionally, if there are views that select * from transactions, they might need recreation 
-- but usually Supabase auto-updates simple views unless explicitly defined with SELECT col1, col2.

-- Verifikasi hasil
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('products', 'transactions') 
  AND column_name IN ('is_prescription_required', 'is_racikan', 'units', 'patient_name', 'doctor_name', 'prescription_number', 'tuslah_fee')
ORDER BY table_name, column_name;
