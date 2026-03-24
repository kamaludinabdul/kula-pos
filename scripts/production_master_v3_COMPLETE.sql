-- =====================================================================================
-- KASIR PRO - FULL PRODUCTION SQL MASTER SCRIPT (V3 COMPLETE)
-- =====================================================================================
-- This script contains ALL necessary schemas, logic, and tables required 
-- to activate BOTH Pharmacy and Pet Clinic (Grooming, Medical, Hotel, Commissions).
-- Execute this single script in your Supabase SQL Editor.
-- =====================================================================================

BEGIN;

-- =====================================================================================
-- PART 1: STORE CONFIGURATIONS
-- =====================================================================================
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS pet_care_enabled BOOLEAN DEFAULT false;

-- =====================================================================================
-- PART 2: PET CLINIC CORE TABLES
-- =====================================================================================

-- 2.1 pets (Patient Registry)
CREATE TABLE IF NOT EXISTS public.pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    medical_record_number TEXT,
    name TEXT NOT NULL DEFAULT 'Unnamed Pet',
    type TEXT DEFAULT 'dog',
    breed TEXT,
    gender TEXT DEFAULT 'male',
    birth_date DATE,
    color TEXT,
    weight NUMERIC(10, 2),
    is_neutered BOOLEAN DEFAULT false,
    is_vaccinated BOOLEAN DEFAULT false,
    vaccinations JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false
);

-- 2.2 pet_services (Service Catalog: grooming, medical, add-ons)
CREATE TABLE IF NOT EXISTS public.pet_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    category TEXT NOT NULL DEFAULT 'other',
    capital_price NUMERIC DEFAULT 0,
    price NUMERIC DEFAULT 0,
    duration INTEGER,
    commission JSONB DEFAULT '{}'::jsonb,
    paramedic_commission JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true
);

-- 2.3 pet_bookings (Reservations)
CREATE TABLE IF NOT EXISTS public.pet_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL DEFAULT 'grooming',
    service_id UUID REFERENCES public.pet_services(id) ON DELETE SET NULL,
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
    notes TEXT
);

-- 2.4 medical_records (EMR)
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES public.pets(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    customer_id TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.pet_bookings(id) ON DELETE SET NULL,
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
    notes TEXT,
    is_paid_pos BOOLEAN DEFAULT false
);

-- 2.5 pet_rooms (Hotel Rooms)
CREATE TABLE IF NOT EXISTS public.pet_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Unnamed Room',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    type TEXT DEFAULT 'Standard',
    capacity INTEGER DEFAULT 1,
    price NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'available',
    current_booking_id UUID
);

-- RM Number Auto-generator Helper
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


-- =====================================================================================
-- PART 3: TRANSACTIONS & MULTI-ROLE COMMISSIONS (PHARMACY & CLINIC)
-- =====================================================================================

-- 3.1 Extend Transactions Table (Pharmacy Fields)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS prescription_number TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS tuslah_fee NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cashier TEXT;

-- 3.2 Extend Transaction Items (Multi-role Commissions)
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id TEXT REFERENCES public.transactions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    qty NUMERIC DEFAULT 1,
    price NUMERIC DEFAULT 0,
    buy_price NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    doctor_id UUID REFERENCES public.profiles(id),
    doctor_commission_type TEXT,
    doctor_commission_value NUMERIC DEFAULT 0,
    doctor_commission_amount NUMERIC DEFAULT 0,
    groomer_id UUID REFERENCES public.profiles(id),
    groomer_commission_amount NUMERIC DEFAULT 0,
    paramedic_id UUID REFERENCES public.profiles(id),
    paramedic_commission_amount NUMERIC DEFAULT 0,
    cashier_id UUID REFERENCES public.profiles(id),
    cashier_commission_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- PART 4: SALARY & HOTEL FEE SHARING TABLES
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.employee_shift_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  schedule_date DATE NOT NULL,
  shift_label TEXT NOT NULL DEFAULT 'pagi', 
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, employee_id, schedule_date, shift_label)
);

CREATE TABLE IF NOT EXISTS public.employee_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  transaction_id TEXT, 
  employee_id UUID, -- Removed FK to profiles because pet hotel staff don't have login accounts
  employee_name TEXT NOT NULL,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  fee_date DATE NOT NULL,
  shift_label TEXT DEFAULT 'pagi',
  is_weekend BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================================
-- PART 5: ROW LEVEL SECURITY POLICIES (RLS)
-- =====================================================================================

DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY['pets', 'pet_services', 'pet_bookings', 'medical_records', 'pet_rooms', 'employee_shift_schedules', 'employee_fees'];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl_name);
        
        EXECUTE format('
            DROP POLICY IF EXISTS multitenant_%I_policy ON public.%I;
            CREATE POLICY multitenant_%I_policy ON public.%I
            FOR ALL USING (
                auth.uid() IN (SELECT id FROM profiles WHERE role = ''super_admin'') 
                OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
                OR store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
            );', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;

-- RLS Policy specifically for transaction_items (relies on transactions table for store_id)
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store members can access transaction_items" ON public.transaction_items;
CREATE POLICY "Store members can access transaction_items" ON public.transaction_items
FOR ALL USING (
    transaction_id IN (
        SELECT id FROM public.transactions
        WHERE store_id IN (
            SELECT store_id FROM public.profiles WHERE id = auth.uid()
            UNION
            SELECT id FROM public.stores WHERE owner_id = auth.uid()
            UNION
            SELECT id FROM public.profiles WHERE role = 'super_admin' AND id = auth.uid()
        )
    )
);


-- =====================================================================================
-- PART 6: MASTER RPC FUNCTIONS
-- =====================================================================================

-- 6.1 Unified process_sale RPC (Pharmacy + Commissions)
DROP FUNCTION IF EXISTS public.process_sale(UUID, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, UUID, JSONB, NUMERIC, UUID, TIMESTAMPTZ, NUMERIC, UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.process_sale(UUID, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, UUID, JSONB, NUMERIC, UUID, TIMESTAMPTZ, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.process_sale(
    p_store_id UUID,
    p_customer_id TEXT,
    p_total NUMERIC,
    p_discount NUMERIC,
    p_payment_method TEXT,
    p_items JSONB,
    p_amount_paid NUMERIC DEFAULT 0,
    p_change NUMERIC DEFAULT 0,
    p_type TEXT DEFAULT 'sale',
    p_rental_session_id UUID DEFAULT NULL,
    p_payment_details JSONB DEFAULT '{}'::jsonb,
    p_points_earned NUMERIC DEFAULT 0,
    p_shift_id UUID DEFAULT NULL,
    p_date TIMESTAMPTZ DEFAULT NOW(),
    p_subtotal NUMERIC DEFAULT NULL,
    p_cashier_id TEXT DEFAULT NULL,
    p_cashier_name TEXT DEFAULT NULL,
    p_patient_name TEXT DEFAULT NULL,
    p_doctor_name TEXT DEFAULT NULL,
    p_prescription_number TEXT DEFAULT NULL,
    p_tuslah_fee NUMERIC DEFAULT 0,
    p_medical_record_id UUID DEFAULT NULL
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_new_transaction_id TEXT;
    v_subtotal NUMERIC;
    v_current_stock NUMERIC;
    v_is_unlimited BOOLEAN;
    v_prod_type TEXT;
    v_is_authorized BOOLEAN;
    v_customer_name TEXT := NULL;
    v_raw_cashier_id TEXT;
    v_resolved_cashier_id UUID := NULL;
    v_resolved_cashier_name TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM stores WHERE id = p_store_id AND owner_id = auth.uid()
        UNION
        SELECT 1 FROM profiles WHERE id = auth.uid() AND store_id = p_store_id
        UNION
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized access.');
    END IF;

    v_subtotal := COALESCE(p_subtotal, p_total + p_discount);

    IF p_customer_id IS NOT NULL THEN
        SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND store_id = p_store_id;
    END IF;
    
    v_raw_cashier_id := COALESCE(p_cashier_id, p_payment_details->>'cashier_id');
    IF v_raw_cashier_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
        v_resolved_cashier_id := v_raw_cashier_id::UUID;
    END IF;

    v_resolved_cashier_name := COALESCE(p_cashier_name, p_payment_details->>'cashier_name', p_payment_details->>'cashier');
    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    INSERT INTO transactions (
        id, store_id, customer_id, customer_name, total, discount, subtotal, payment_method, 
        amount_paid, "change", "type", rental_session_id, payment_details, 
        items, date, status, shift_id, points_earned,
        cashier_id, cashier, medical_record_id, patient_name, doctor_name, prescription_number, tuslah_fee
    )
    VALUES (
        v_new_transaction_id, p_store_id, p_customer_id, v_customer_name, p_total, p_discount, v_subtotal, p_payment_method, 
        p_amount_paid, p_change, p_type, p_rental_session_id, p_payment_details, 
        p_items, p_date, 'completed', p_shift_id, p_points_earned,
        v_resolved_cashier_id, v_resolved_cashier_name, p_medical_record_id, p_patient_name, p_doctor_name, p_prescription_number, p_tuslah_fee
    );

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        id TEXT, qty NUMERIC, name TEXT, price NUMERIC, buy_price NUMERIC, discount NUMERIC, stock_deducted BOOLEAN,
        doctor_id TEXT, doctor_commission_type TEXT, doctor_commission_value NUMERIC, doctor_commission_amount NUMERIC,
        groomer_id TEXT, groomer_commission_amount NUMERIC, paramedic_id TEXT, paramedic_commission_amount NUMERIC,
        cashier_id TEXT, cashier_commission_amount NUMERIC
    )
    LOOP
        INSERT INTO transaction_items (
            transaction_id, product_id, name, qty, price, buy_price, discount,
            doctor_id, doctor_commission_type, doctor_commission_value, doctor_commission_amount,
            groomer_id, groomer_commission_amount, paramedic_id, paramedic_commission_amount,
            cashier_id, cashier_commission_amount
        )
        VALUES (
            v_new_transaction_id, 
            CASE WHEN v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN v_item.id::UUID ELSE NULL END,
            v_item.name, v_item.qty, v_item.price, COALESCE(v_item.buy_price, 0), COALESCE(v_item.discount, 0),
            CASE WHEN v_item.doctor_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN v_item.doctor_id::UUID ELSE NULL END, 
            v_item.doctor_commission_type, v_item.doctor_commission_value, v_item.doctor_commission_amount,
            CASE WHEN v_item.groomer_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN v_item.groomer_id::UUID ELSE NULL END, 
            COALESCE(v_item.groomer_commission_amount, 0),
            CASE WHEN v_item.paramedic_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN v_item.paramedic_id::UUID ELSE NULL END, 
            COALESCE(v_item.paramedic_commission_amount, 0),
            CASE WHEN v_item.cashier_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN v_item.cashier_id::UUID ELSE NULL END, 
            COALESCE(v_item.cashier_commission_amount, 0)
        );

        IF COALESCE(v_item.stock_deducted, false) IS TRUE THEN CONTINUE; END IF;

        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            SELECT stock, COALESCE((SELECT is_unlimited FROM products WHERE id = v_item.id::UUID), false),
                   COALESCE((SELECT type FROM products WHERE id = v_item.id::UUID), 'product')
            INTO v_current_stock, v_is_unlimited, v_prod_type
            FROM products WHERE id = v_item.id::UUID AND store_id = p_store_id FOR UPDATE;

            IF FOUND THEN
                IF v_is_unlimited = false AND v_prod_type != 'service' AND v_current_stock < v_item.qty THEN
                    RAISE EXCEPTION 'Stok tidak cukup: % (Sisa: %, Diminta: %)', v_item.name, v_current_stock, v_item.qty;
                END IF;

                UPDATE products 
                SET stock = stock - v_item.qty, sold = sold + v_item.qty, revenue = revenue + (v_item.qty * (v_item.price - COALESCE(v_item.discount, 0)))
                WHERE id = v_item.id::UUID AND store_id = p_store_id;

                INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
                VALUES (p_store_id, v_item.id::UUID, 'sale', -v_item.qty, p_date, 'Penjualan #' || right(v_new_transaction_id, 6), v_new_transaction_id);
            END IF;
        END IF;
    END LOOP;

    IF p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET total_spent = total_spent + p_total, loyalty_points = loyalty_points + p_points_earned,
            total_lifetime_points = total_lifetime_points + p_points_earned, debt = CASE WHEN p_payment_method = 'debt' THEN debt + p_total ELSE debt END
        WHERE id = p_customer_id AND store_id = p_store_id;

        IF p_points_earned > 0 THEN
            INSERT INTO loyalty_history (store_id, customer_id, points, description, transaction_id, date)
            VALUES (p_store_id, p_customer_id, p_points_earned, 'Penjualan #' || v_new_transaction_id, v_new_transaction_id, p_date);
        END IF;
    END IF;

    IF p_medical_record_id IS NOT NULL THEN
        UPDATE medical_records SET is_paid_pos = true, payment_status = 'paid' WHERE id = p_medical_record_id AND store_id = p_store_id;
    END IF;

    IF p_shift_id IS NOT NULL THEN
        UPDATE shifts SET 
            total_sales = COALESCE(total_sales, 0) + p_total, total_discount = COALESCE(total_discount, 0) + p_discount,
            total_cash_sales = CASE WHEN p_payment_method = 'cash' THEN COALESCE(total_cash_sales, 0) + p_total ELSE COALESCE(total_cash_sales, 0) END,
            total_non_cash_sales = CASE WHEN p_payment_method != 'cash' THEN COALESCE(total_non_cash_sales, 0) + p_total ELSE COALESCE(total_non_cash_sales, 0) END
        WHERE id = p_shift_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id, 'customer_name', v_customer_name);
END;
$$;

-- 6.2 Commissions Reporting RPC
CREATE OR REPLACE FUNCTION get_all_commissions_report(
    p_store_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    staff_id UUID,
    staff_name TEXT,
    staff_role TEXT,
    total_items BIGINT,
    total_commission NUMERIC,
    item_details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        staff.id as staff_id, staff.name as staff_name, staff.role as staff_role,
        COUNT(c.transaction_id) as total_items, SUM(c.amount) as total_commission,
        jsonb_agg(jsonb_build_object('transaction_id', t.id, 'date', t.date, 'item_name', c.item_name, 'price', c.price, 'qty', c.qty, 'role_context', c.role_context, 'commission', c.amount, 'patient_name', t.patient_name) ORDER BY t.date DESC) as item_details
    FROM (
        SELECT transaction_id, name as item_name, price, qty, doctor_id as staff_id, 'Dokter' as role_context, doctor_commission_amount as amount FROM transaction_items WHERE doctor_id IS NOT NULL AND doctor_commission_amount > 0
        UNION ALL
        SELECT transaction_id, name as item_name, price, qty, groomer_id as staff_id, 'Groomer' as role_context, groomer_commission_amount as amount FROM transaction_items WHERE groomer_id IS NOT NULL AND groomer_commission_amount > 0
        UNION ALL
        SELECT transaction_id, name as item_name, price, qty, paramedic_id as staff_id, 'Paramedis' as role_context, paramedic_commission_amount as amount FROM transaction_items WHERE paramedic_id IS NOT NULL AND paramedic_commission_amount > 0
        UNION ALL
        SELECT transaction_id, name as item_name, price, qty, cashier_id as staff_id, 'Kasir' as role_context, cashier_commission_amount as amount FROM transaction_items WHERE cashier_id IS NOT NULL AND cashier_commission_amount > 0
    ) c
    JOIN transactions t ON c.transaction_id = t.id
    JOIN profiles staff ON c.staff_id = staff.id
    WHERE t.store_id = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date
    GROUP BY staff.id, staff.name, staff.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================================
-- PART 7: GENERAL ENHANCEMENTS (MULTI-UNIT / SATUAN BERJENJANG)
-- =====================================================================================

-- Add `units` column to products for multi-unit (Satuan Berjenjang) feature
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS units JSONB DEFAULT '[]'::jsonb;

-- =====================================================================================
-- END OF MASTER SCRIPT COMPLETE
-- =====================================================================================
