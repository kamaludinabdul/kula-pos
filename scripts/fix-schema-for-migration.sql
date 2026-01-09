-- Add missing columns to purchase_orders
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) DEFAULT 0;

-- Add missing columns to shifts
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_sales NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add missing columns to rental_sessions
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS agreed_total NUMERIC(15, 2) DEFAULT 0;
