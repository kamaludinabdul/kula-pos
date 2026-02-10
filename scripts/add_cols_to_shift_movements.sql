-- Add expense_group column to shift_movements table
ALTER TABLE shift_movements
ADD COLUMN IF NOT EXISTS expense_group TEXT DEFAULT 'operational';

-- Add category column to shift_movements table if it doesn't exist (just in case)
ALTER TABLE shift_movements
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
