-- Add missing columns to rental_sessions table
ALTER TABLE rental_sessions 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS product_price NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_name TEXT;

-- Refresh the schema cache if necessary (usually happens automatically but good to note)
COMMENT ON TABLE rental_sessions IS 'Updated with product info columns';
