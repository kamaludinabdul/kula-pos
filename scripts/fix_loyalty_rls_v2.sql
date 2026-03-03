-- Fix RLS Policies for loyalty tables to allow inserts by store members

BEGIN;

-- 1. Fix loyalty_product_rules
DROP POLICY IF EXISTS "loyalty_product_rules_policy" ON public.loyalty_product_rules;
CREATE POLICY "loyalty_product_rules_policy" ON public.loyalty_product_rules
FOR ALL TO authenticated USING (
    store_id = get_my_store_id() OR is_super_admin()
);

-- 2. Fix customer_stamps
-- Customer stamps are tied to customer_id. We check if the customer belongs to the user's store.
DROP POLICY IF EXISTS "customer_stamps_policy" ON public.customer_stamps;
CREATE POLICY "customer_stamps_policy" ON public.customer_stamps
FOR ALL TO authenticated USING (
    customer_id IN (
        SELECT id FROM public.customers WHERE store_id = get_my_store_id()
    ) OR is_super_admin()
);

-- 3. Just to be safe, fix loyalty_history as well
DROP POLICY IF EXISTS "loyalty_history_policy" ON public.loyalty_history;
CREATE POLICY "loyalty_history_policy" ON public.loyalty_history
FOR ALL TO authenticated USING (
    customer_id IN (
        SELECT id FROM public.customers WHERE store_id = get_my_store_id()
    ) OR is_super_admin()
);

COMMIT;
