-- Create Pets Table
CREATE TABLE IF NOT EXISTS pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'Cat',
    breed TEXT,
    gender TEXT,
    birth_date TIMESTAMPTZ,
    weight NUMERIC(10, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Medical Records Table
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    pet_id UUID REFERENCES pets(id) ON DELETE CASCADE,
    date TIMESTAMPTZ,
    diagnosis TEXT,
    treatment TEXT,
    notes TEXT,
    doctor_name TEXT,
    next_visit TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Rooms Table (Hotel)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT,
    capacity INTEGER DEFAULT 1,
    price_per_night NUMERIC(15, 2) DEFAULT 0,
    status TEXT DEFAULT 'available',
    features JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to shift_movements if not exists (or create table)
-- shift_movements existed in grep, but let's ensure it matches what we want
-- It was CREATE TABLE IF NOT EXISTS shift_movements
-- Let's just trust it exists as per grep.
