-- =====================================================================================
-- KASIR PRO SUPABASE - FINAL PRODUCTION SYNC (MARCH 2026)
-- =====================================================================================
-- This script synchronizes the production database with all recent developments:
-- 1. Pet Shop Module (Tables, Columns, RLS)
-- 2. Doctor Commissions & Clinical Layout
-- 3. Registration & Subscription Plan Fixes
-- 4. Shift Report Reconciliation (Anti-Double Sales)
-- 5. Error Reporting System
-- 6. Auto RM Number Logic
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- 1. REGISTRATION & SUBSCRIPTION PLANS
-- =====================================================================================

-- 1.1 Debug Logs for troubleshooting
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id BIGSERIAL PRIMARY KEY,
    location TEXT,
    error_message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on debug_logs (required for PostgREST security)
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS multitenant_debug_logs_policy ON public.debug_logs;
CREATE POLICY multitenant_debug_logs_policy ON public.debug_logs
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
        OR store_id IS NULL -- debug_logs has no store_id, restrict to super_admin only
    ) WITH CHECK (
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin')
    );

-- 1.2 Subscription Plans Update
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_plans' AND column_name = 'business_type') THEN
        ALTER TABLE public.subscription_plans ADD COLUMN business_type TEXT DEFAULT 'general';
    END IF;
END $$;

INSERT INTO public.subscription_plans (id, name, business_type, max_products, max_stores, max_staff, price, features)
VALUES 
    ('free', 'Free', 'general', 50, 1, 1, 0, '[]'),
    ('pro', 'Pro', 'general', 500, 3, 5, 150000, '["reports.profit_loss", "reports.cash_flow", "products.stock_history"]'),
    ('enterprise', 'Enterprise', 'general', 10000, 10, 50, 350000, '["reports.profit_loss", "reports.cash_flow", "smart_insights", "features.ai_bundling"]'),
    ('pet_clinic_free', 'Pet Shop Free', 'pet_clinic', 50, 1, 1, 0, '[]'),
    ('pet_clinic_pro', 'Pet Shop Pro', 'pet_clinic', 500, 3, 10, 250000, '["pet_hotel", "pet_grooming", "pet_clinic_emr", "reports.profit_loss"]'),
    ('pet_clinic_enterprise', 'Pet Shop Enterprise', 'pet_clinic', -1, 10, -1, 500000, '["pet_hotel", "pet_grooming", "pet_clinic_emr", "smart_insights"]')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    business_type = EXCLUDED.business_type,
    max_products = EXCLUDED.max_products,
    max_stores = EXCLUDED.max_stores,
    max_staff = EXCLUDED.max_staff,
    features = EXCLUDED.features;

-- 1.3 Stores Plan Constraint Fix
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'plan') THEN
        ALTER TABLE public.stores ADD COLUMN plan TEXT DEFAULT 'free';
    END IF;
    ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_plan_id_fkey;
    ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_plan_fkey;
    ALTER TABLE public.stores ADD CONSTRAINT stores_plan_fkey FOREIGN KEY (plan) REFERENCES public.subscription_plans(id) ON UPDATE CASCADE;
END $$;

-- 1.4 Business Type & Expiry columns
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'general';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS plan_expiry_date TIMESTAMPTZ;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- =====================================================================================
-- 2. PET SHOP MODULE
-- =====================================================================================

-- 2.1 Base Tables
CREATE TABLE IF NOT EXISTS public.pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    name TEXT NOT NULL DEFAULT 'Unnamed Pet',
    pet_type TEXT DEFAULT 'dog',
    breed TEXT,
    gender TEXT DEFAULT 'male',
    birth_date DATE,
    pet_age TEXT,
    color TEXT,
    weight NUMERIC(10, 2),
    is_neutered BOOLEAN DEFAULT false,
    is_vaccinated BOOLEAN DEFAULT false,
    vaccinations JSONB DEFAULT '[]'::jsonb,
    special_needs TEXT,
    medical_history TEXT,
    image_url TEXT,
    rm_number TEXT,
    is_deleted BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.pet_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    capital_price NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    duration INTEGER,
    commission JSONB DEFAULT '{}'::jsonb,
    paramedic_commission JSONB DEFAULT '{}'::jsonb,
    doctor_fee_type TEXT DEFAULT 'fixed',
    doctor_fee_value NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pet_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL DEFAULT 'grooming',
    service_id UUID REFERENCES public.pet_services(id),
    room_id UUID,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME,
    end_date DATE,
    status TEXT DEFAULT 'pending',
    unit_price NUMERIC DEFAULT 0,
    total_price NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    groomer_id UUID,
    anamnesis JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    extra_items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.pet_bookings(id),
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    doctor_id UUID,
    doctor_name TEXT,
    paramedic_id UUID,
    symptoms TEXT,
    diagnosis TEXT,
    treatment TEXT,
    services JSONB DEFAULT '[]'::jsonb,
    prescriptions JSONB DEFAULT '[]'::jsonb,
    next_visit DATE,
    payment_status TEXT DEFAULT 'unpaid',
    is_paid_pos BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pet_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Unnamed Room',
    type TEXT DEFAULT 'Standard',
    capacity INTEGER DEFAULT 1,
    price NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'available',
    current_booking_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pet_daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.pet_bookings(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    eating TEXT,
    mood TEXT,
    bathroom TEXT,
    notes TEXT,
    staff_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Indexes
CREATE INDEX IF NOT EXISTS idx_pets_store_id ON public.pets(store_id);
CREATE INDEX IF NOT EXISTS idx_pet_bookings_store_id ON public.pet_bookings(store_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id ON public.medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_daily_logs_booking_id ON public.pet_daily_logs(booking_id);

-- 2.3 Align Products & Services for Doctor Fees
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS doctor_fee_type TEXT DEFAULT 'fixed';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS doctor_fee_value NUMERIC DEFAULT 0;

ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS doctor_fee_type TEXT DEFAULT 'fixed';
ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS doctor_fee_value NUMERIC DEFAULT 0;

-- =====================================================================================
-- 3. AUTO RM LOGIC & TRIGGERS
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.generate_pet_rm_number(p_store_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_new_number TEXT;
    v_prefix TEXT := 'RM-';
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.pets WHERE store_id = p_store_id;
    v_new_number := v_prefix || lpad((v_count + 1)::text, 4, '0');
    RETURN v_new_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trg_generate_pet_rm()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rm_number IS NULL OR NEW.rm_number = '' THEN
        NEW.rm_number := public.generate_pet_rm_number(NEW.store_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_before_insert_pet ON public.pets;
CREATE TRIGGER trg_before_insert_pet
BEFORE INSERT ON public.pets
FOR EACH ROW
EXECUTE FUNCTION public.trg_generate_pet_rm();

-- =====================================================================================
-- 4. ERROR REPORTING SYSTEM
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  page_url TEXT,
  description TEXT,
  error_message TEXT,
  error_stack TEXT,
  browser_info JSONB DEFAULT '{}'::jsonb,
  app_version TEXT,
  status TEXT DEFAULT 'open',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_reports_status ON error_reports(status);

-- =====================================================================================
-- 5. SHIFT REPORT RECONCILIATION (ANTI-DOUBLE SALES)
-- =====================================================================================

CREATE OR REPLACE FUNCTION public.handle_shift_closure_reconciliation()
RETURNS VOID AS $$
BEGIN
    -- 1. Recalculate shift sales totals from transactions (The source of truth)
    UPDATE shifts s
    SET 
        total_sales = COALESCE(tx.calc_total_sales, 0),
        total_discount = COALESCE(tx.calc_total_discount, 0),
        total_cash_sales = COALESCE(tx.calc_total_cash_sales, 0),
        total_non_cash_sales = COALESCE(tx.calc_total_non_cash_sales, 0)
    FROM (
        SELECT 
            t.shift_id,
            SUM(CASE WHEN t.status = 'completed' THEN t.total ELSE 0 END) as calc_total_sales,
            SUM(CASE WHEN t.status = 'completed' THEN COALESCE(t.discount, 0) ELSE 0 END) as calc_total_discount,
            SUM(CASE 
                WHEN t.status = 'completed' AND t.payment_method = 'cash' THEN t.total 
                WHEN t.status = 'completed' AND t.payment_method = 'split' AND t.payment_details->>'method1' = 'cash' 
                    THEN (t.payment_details->>'amount1')::NUMERIC
                WHEN t.status = 'completed' AND t.payment_method = 'split' AND t.payment_details->>'method2' = 'cash' 
                    THEN (t.payment_details->>'amount2')::NUMERIC
                ELSE 0 
            END) as calc_total_cash_sales,
            SUM(CASE 
                WHEN t.status = 'completed' AND t.payment_method NOT IN ('cash', 'split') THEN t.total
                WHEN t.status = 'completed' AND t.payment_method = 'split' THEN
                    (CASE WHEN t.payment_details->>'method1' != 'cash' THEN (t.payment_details->>'amount1')::NUMERIC ELSE 0 END) +
                    (CASE WHEN t.payment_details->>'method2' != 'cash' THEN (t.payment_details->>'amount2')::NUMERIC ELSE 0 END)
                ELSE 0 
            END) as calc_total_non_cash_sales
        FROM transactions t
        WHERE t.shift_id IS NOT NULL
        GROUP BY t.shift_id
    ) tx
    WHERE s.id = tx.shift_id;

    -- 2. Recalculate expected_cash for CLOSED shifts
    UPDATE shifts
    SET 
        expected_cash = COALESCE(initial_cash, 0) + COALESCE(total_cash_sales, 0) + COALESCE(total_cash_in, 0) - COALESCE(total_cash_out, 0),
        cash_difference = COALESCE(final_cash, 0) - (COALESCE(initial_cash, 0) + COALESCE(total_cash_sales, 0) + COALESCE(total_cash_in, 0) - COALESCE(total_cash_out, 0)),
        expected_non_cash = COALESCE(total_non_cash_sales, 0),
        non_cash_difference = COALESCE(final_non_cash, 0) - COALESCE(total_non_cash_sales, 0)
    WHERE status = 'closed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================================
-- 6. SECURITY (RLS Policies)
-- =====================================================================================

DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY['pets', 'pet_services', 'pet_bookings', 'medical_records', 'pet_rooms', 'pet_daily_logs', 'error_reports'];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl_name);
        EXECUTE format('DROP POLICY IF EXISTS multitenant_%I_policy ON public.%I;', tbl_name, tbl_name);
        EXECUTE format('CREATE POLICY multitenant_%I_policy ON public.%I FOR ALL USING (auth.uid() IN (SELECT id FROM profiles WHERE role = ''super_admin'') OR store_id = get_my_store_id()) WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = ''super_admin'') OR store_id = get_my_store_id());', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;

-- =====================================================================================
-- 7. PET HOTEL MODULE - Rental-Style Columns
-- =====================================================================================

-- Link pet rooms to a product/service for pricing
ALTER TABLE public.pet_rooms ADD COLUMN IF NOT EXISTS linked_service_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Track the current active booking in a room
ALTER TABLE public.pet_rooms ADD COLUMN IF NOT EXISTS current_booking_id UUID REFERENCES public.pet_bookings(id) ON DELETE SET NULL;

-- Add notes field to pet bookings (used for hotel check-in instructions)
ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS notes TEXT;

COMMIT;

-- Sync PostgREST
NOTIFY pgrst, 'reload schema';
