-- Add is_wholesale column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN DEFAULT FALSE;

-- Update comment
COMMENT ON COLUMN public.products.is_wholesale IS 'If true, uses Wholesale/Grosir logic (Threshold). If false, uses standard Bundling logic (Greedy Sum).';
