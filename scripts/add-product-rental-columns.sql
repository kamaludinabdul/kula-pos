-- Add is_bundling_enabled column
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bundling_enabled BOOLEAN DEFAULT false;

-- Add pricing_type column
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'standard';

-- Add pricing_tiers column
ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]'::jsonb;

-- Ensure image_url exists (just in case)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_pricing_type ON products(pricing_type);
