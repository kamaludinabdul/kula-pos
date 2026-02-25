-- Add notes column to rental_sessions table
ALTER TABLE rental_sessions 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Refresh the schema cache
COMMENT ON TABLE rental_sessions IS 'Updated with notes column';
