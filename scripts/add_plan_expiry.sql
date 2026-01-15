-- Ensure plan_expiry_date column exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'plan_expiry_date') THEN
        ALTER TABLE public.stores ADD COLUMN plan_expiry_date TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Update existing Pro/Enterprise stores to have an expiry date (e.g., 30 days from now) for testing
-- This ensures the UI is not empty
UPDATE public.stores
SET plan_expiry_date = NOW() + INTERVAL '30 days'
WHERE plan IN ('pro', 'enterprise') AND plan_expiry_date IS NULL;
