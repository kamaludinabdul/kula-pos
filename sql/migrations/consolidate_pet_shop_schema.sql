-- =====================================================================================
-- KASIR PRO SUPABASE - PET SHOP INTEGRATION MIGRATION
-- =====================================================================================
-- This script consolidates and expands the database schema for pet shop features.
-- It handles existing basic tables and adds new columns, indexes, and RLS policies.
-- =====================================================================================

BEGIN;

-- 1. BASE TABLES CONSOLIDATION
-- =====================================================================================

-- 1.1 pets (Patient Registry)
CREATE TABLE IF NOT EXISTS public.pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL;
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS medical_record_number TEXT;
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Unnamed Pet';
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'dog';
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS breed TEXT;
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS birth_date DATE;
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS color TEXT;
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS weight NUMERIC(10, 2);
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS is_neutered BOOLEAN DEFAULT false;
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS is_vaccinated BOOLEAN DEFAULT false;
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS vaccinations JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
END $$;

-- 1.2 pet_services (Service Catalog: grooming, medical, add-ons)
CREATE TABLE IF NOT EXISTS public.pet_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';
    ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS capital_price NUMERIC DEFAULT 0;
    ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
    ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS duration INTEGER;
    ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS commission JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS paramedic_commission JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.pet_services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
END $$;

-- 1.3 pet_bookings (Reservations)
CREATE TABLE IF NOT EXISTS public.pet_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS service_type TEXT NOT NULL DEFAULT 'grooming';
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.pet_services(id);
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS room_id UUID;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS start_time TIME;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS end_date DATE;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS groomer_id UUID;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS anamnesis JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.pet_bookings ADD COLUMN IF NOT EXISTS notes TEXT;
END $$;

-- 1.4 medical_records (EMR)
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.pet_bookings(id);
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS doctor_id UUID;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS doctor_name TEXT;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS paramedic_id UUID;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS symptoms TEXT;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS diagnosis TEXT;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS treatment TEXT;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS prescriptions JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS next_visit DATE;
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
    ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS notes TEXT;
END $$;

-- 1.5 pet_rooms (Hotel Rooms)
CREATE TABLE IF NOT EXISTS public.pet_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Unnamed Room',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    ALTER TABLE public.pet_rooms ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Standard';
    ALTER TABLE public.pet_rooms ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 1;
    ALTER TABLE public.pet_rooms ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
    ALTER TABLE public.pet_rooms ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
    ALTER TABLE public.pet_rooms ADD COLUMN IF NOT EXISTS current_booking_id UUID;
END $$;


-- 2. INDEXES
-- =====================================================================================
CREATE INDEX IF NOT EXISTS idx_pets_store_id ON public.pets(store_id);
CREATE INDEX IF NOT EXISTS idx_pets_customer_id ON public.pets(customer_id);
CREATE INDEX IF NOT EXISTS idx_pet_bookings_store_id ON public.pet_bookings(store_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_pet_id ON public.medical_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_store_id ON public.medical_records(store_id);


-- 3. HELPER FUNCTIONS
-- =====================================================================================

-- 3.1 RM Number Auto-generator
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


-- 4. SECURITY (RLS Policies)
-- =====================================================================================

DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY['pets', 'pet_services', 'pet_bookings', 'medical_records', 'pet_rooms'];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl_name);
        
        EXECUTE format('
            DROP POLICY IF EXISTS multitenant_%I_policy ON public.%I;
            CREATE POLICY multitenant_%I_policy ON public.%I
            FOR ALL USING (
                auth.uid() IN (SELECT id FROM profiles WHERE role = ''super_admin'') 
                OR store_id = get_my_store_id()
            ) WITH CHECK (
                auth.uid() IN (SELECT id FROM profiles WHERE role = ''super_admin'') 
                OR store_id = get_my_store_id()
            );', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;


COMMIT;

NOTIFY pgrst, 'reload schema';
