-- Enable RLS on loyalty_history table
ALTER TABLE public.loyalty_history ENABLE ROW LEVEL SECURITY;

-- Verify policies exist (optional comment)
-- Policies should already be created by create-loyalty-history.sql
-- If not, they need to be re-created. This script assumes policies exist but RLS is off.
