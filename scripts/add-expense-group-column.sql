-- Add expense_group to shift_movements to align with cash_flow classification
ALTER TABLE public.shift_movements 
ADD COLUMN IF NOT EXISTS expense_group TEXT DEFAULT 'operational'; -- 'operational' or 'non_operational'

-- Optional: Update RLS if needed, but existing policy covers 'all columns' usually.
