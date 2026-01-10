-- Create 'product-images' Storage Bucket and Policies

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on objects (Standard practice)
-- (Supabase storage.objects usually has RLS enabled by default, but verifying policies is good)

-- 3. Create Policy: Public Access to Read Images
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- 4. Create Policy: Authenticated Users can Upload
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'product-images' 
    AND auth.role() = 'authenticated'
);

-- 5. Create Policy: Authenticated Users can Update/Delete their own uploads (Optional/Advanced)
-- For simplicity in this POS app, we might allow any authenticated user (staff/admin) to manage images for now
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'product-images' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'product-images' AND auth.role() = 'authenticated' );

-- Verify
DO $$ 
BEGIN
    RAISE NOTICE 'Bucket product-images created/verified with public access.';
END $$;
