-- Add missing columns to stores table for Fees & Discount settings
ALTER TABLE stores ADD COLUMN IF NOT EXISTS enable_discount BOOLEAN DEFAULT FALSE;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS discount_pin TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS service_charge NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'exclusive';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
