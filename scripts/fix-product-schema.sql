-- SQL Migration: consolidate missing columns for products table
-- Run this in your Supabase SQL Editor

-- 1. Ensure all columns exist
ALTER TABLE products
ADD COLUMN IF NOT EXISTS min_stock NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'product',
ADD COLUMN IF NOT EXISTS sold NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS discount NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percent',
ADD COLUMN IF NOT EXISTS is_unlimited BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS purchase_unit TEXT,
ADD COLUMN IF NOT EXISTS conversion_to_unit NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS weight NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS rack_location TEXT,
ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_bundling_enabled BOOLEAN DEFAULT false;

-- 2. Check for defunct 'image' column and remove it if it exists to avoid cache issues
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='image') THEN
        ALTER TABLE products DROP COLUMN image;
    END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_pricing_type ON products(pricing_type);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);

-- 4. FORCE SCHEMA RELOAD
NOTIFY pgrst, 'reload schema';
