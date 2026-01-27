-- Add penalty related columns to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS overtime_hourly_penalty NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_trigger_hours NUMERIC DEFAULT 1;

-- Update comments
COMMENT ON COLUMN public.products.overtime_hourly_penalty IS 'Nominal denda per jam jika telat (Khusus produk harian).';
COMMENT ON COLUMN public.products.overtime_trigger_hours IS 'Batas jam telat sebelum denda berubah menjadi bayar 1 hari penuh.';
