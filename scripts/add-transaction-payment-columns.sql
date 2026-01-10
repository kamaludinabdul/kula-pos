-- Add missing columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "change" NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_earned NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'sale',
ADD COLUMN IF NOT EXISTS rental_session_id UUID,
ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) DEFAULT 0;

-- Optional: Index for rental_session_id
CREATE INDEX IF NOT EXISTS idx_transactions_rental_session_id ON transactions(rental_session_id);

-- Optional: Index for type
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
