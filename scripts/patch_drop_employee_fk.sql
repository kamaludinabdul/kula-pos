-- Patch: Drop FK constraint on employee_id for both tables
-- This allows using dummy UUIDs for pet hotel staff who don't have login accounts.

-- For employee_fees
ALTER TABLE employee_fees DROP CONSTRAINT IF EXISTS employee_fees_employee_id_fkey;

-- For employee_shift_schedules (no longer actively used, but clean up constraint anyway)
ALTER TABLE employee_shift_schedules DROP CONSTRAINT IF EXISTS employee_shift_schedules_employee_id_fkey;
