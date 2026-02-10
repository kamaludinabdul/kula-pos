-- Add total_cash_in column to shifts table
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS total_cash_in NUMERIC(15, 2) DEFAULT 0;

-- Add total_cash_out column to shifts table
ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS total_cash_out NUMERIC(15, 2) DEFAULT 0;
