-- =====================================================================================
-- SUBSCRIPTION SYSTEM SETUP (Semi-Manual Flow)
-- =====================================================================================

BEGIN;

-- 1. Create subscription_invoices table
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL, -- 'pro', 'enterprise'
    amount NUMERIC(15, 2) NOT NULL,
    unique_code INTEGER DEFAULT 0,
    duration_months INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending', -- pending, paid, failed, expired, approved
    payment_method TEXT DEFAULT 'transfer', -- 'transfer', 'qris'
    proof_url TEXT,
    external_id TEXT, -- for future gateway integration
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES profiles(id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_store_id ON public.subscription_invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON public.subscription_invoices(status);

-- 3. RLS Policies
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

-- Allow Store Owners to VIEW their own invoices
DROP POLICY IF EXISTS "View own invoices" ON public.subscription_invoices;
CREATE POLICY "View own invoices" ON public.subscription_invoices
FOR SELECT
USING (store_id = get_my_store_id() OR is_super_admin());

-- Allow Store Owners to INSERT their own invoices
DROP POLICY IF EXISTS "Create own invoices" ON public.subscription_invoices;
CREATE POLICY "Create own invoices" ON public.subscription_invoices
FOR INSERT
WITH CHECK (store_id = get_my_store_id());

-- Allow Super Admin to UPDATE (Approve)
DROP POLICY IF EXISTS "Admin update invoices" ON public.subscription_invoices;
CREATE POLICY "Admin update invoices" ON public.subscription_invoices
FOR UPDATE
USING (is_super_admin());

-- 4. Storage Bucket Setup (Idempotent via RPC call usually, but script here for reference)
-- Note: Bucket creation usually needs to be done via direct SQL insert to storage.buckets or API.
-- We will try to insert if not exists, safe wrapper.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage Policies
-- Allow Authenticated upload
DROP POLICY IF EXISTS "Authenticated Upload Proof" ON storage.objects;
CREATE POLICY "Authenticated Upload Proof" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

-- Allow Owners to View their own proof (and Admins)
-- Note: Storage policies are tricky with 'select', often easier to assume authenticated read if signed URL used
DROP POLICY IF EXISTS "Authenticated Select Proof" ON storage.objects;
CREATE POLICY "Authenticated Select Proof" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs');

COMMIT;

NOTIFY pgrst, 'reload schema';
