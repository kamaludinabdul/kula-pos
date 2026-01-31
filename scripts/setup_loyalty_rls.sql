-- 1. Enable RLS
ALTER TABLE public.loyalty_history ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policy to prevent conflicts (if any)
DROP POLICY IF EXISTS "Users can view loyalty history of their store customers" ON public.loyalty_history;

-- 3. Create Select Policy
-- Users (Staff/Owners) can view loyalty history if the customer belongs to their store.
CREATE POLICY "Users can view loyalty history of their store customers"
ON public.loyalty_history
FOR SELECT
TO authenticated
USING (
  exists (
    select 1 
    from public.customers c 
    where c.id = loyalty_history.customer_id 
    and c.store_id = get_my_store_id()
  )
);

-- Note: INSERT/UPDATE/DELETE are usually handled via Security Definer RPCs (process_sale, manual_adjustment etc)
-- so we don't necessarily need policies for them unless direct access is required from frontend.
