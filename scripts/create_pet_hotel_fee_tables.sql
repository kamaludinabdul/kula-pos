-- Migration script for Pet Hotel Fee Splitting feature
-- This creates the necessary tables to store employee shift schedules and calculated fees.

-- 1. Create table for fixed/flexible monthly schedules
CREATE TABLE IF NOT EXISTS employee_shift_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  schedule_date DATE NOT NULL,
  shift_label TEXT NOT NULL DEFAULT 'pagi', -- 'pagi', 'siang', 'full', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, employee_id, schedule_date, shift_label)
);

-- Enable RLS
ALTER TABLE employee_shift_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_shift_schedules
CREATE POLICY "Store members can view schedules"
  ON employee_shift_schedules FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE id = store_id));

CREATE POLICY "Store admins can insert schedules"
  ON employee_shift_schedules FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE id = store_id));

CREATE POLICY "Store admins can update schedules"
  ON employee_shift_schedules FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE id = store_id));

CREATE POLICY "Store admins can delete schedules"
  ON employee_shift_schedules FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE id = store_id));


-- 2. Create table for generated fees per transaction
CREATE TABLE IF NOT EXISTS employee_fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  transaction_id TEXT, -- Can be null if manual addition, but usually references a transaction
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  fee_date DATE NOT NULL,
  shift_label TEXT DEFAULT 'pagi',
  is_weekend BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE employee_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_fees
CREATE POLICY "Store members can view their own fees or all if admin"
  ON employee_fees FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE id = store_id));

CREATE POLICY "Store admins can insert fees"
  ON employee_fees FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE id = store_id));

CREATE POLICY "Store admins can update fees"
  ON employee_fees FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE id = store_id));

CREATE POLICY "Store admins can delete fees"
  ON employee_fees FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE id = store_id));
