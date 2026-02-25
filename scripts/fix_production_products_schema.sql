-- Migration to fix 400 Bad Request error on Product Add/Edit
-- Adds columns that were added to the frontend but are missing in database

ALTER TABLE public.products
-- Jenis Stok (Barang / Jasa)
ADD COLUMN IF NOT EXISTS stock_type TEXT DEFAULT 'Barang',

-- Bundling vs Grosir flag
ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN DEFAULT false,

-- Rental / Durasi penalty configs
ADD COLUMN IF NOT EXISTS overtime_hourly_penalty NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_trigger_hours NUMERIC DEFAULT 0;

-- Optional: reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
