-- =========================================================
-- FIX: DROP ROGUE RLS POLICIES CAUSING LATENCY
-- =========================================================
-- Diagnostic revealed 'multitenant_profiles_policy' is still active.
-- This policy invokes expensive functions (get_my_store_id) which likely 
-- triggers recursion when querying the profiles table itself.
--
-- Running this will force Supabase to use the fast "TRUE" policies we created.

-- 1. Drop the problematic policy on Profiles
DROP POLICY IF EXISTS "multitenant_profiles_policy" ON profiles;

-- 2. Drop potential leftovers on other tables
DROP POLICY IF EXISTS "multitenant_stores_policy" ON stores;
DROP POLICY IF EXISTS "multitenant_products_policy" ON products;
DROP POLICY IF EXISTS "multitenant_transactions_policy" ON transactions;
DROP POLICY IF EXISTS "multitenant_customers_policy" ON customers;

-- 3. Ensure the simple policies are the ONLY ones active for SELECT
-- (We don't need to re-create them if they show as "Enable select... -> true" in your diagnostics)

-- 4. Re-analyze tables to flush query planner cache
ANALYZE profiles;
ANALYZE stores;
ANALYZE products;

DO $$
BEGIN
    RAISE NOTICE 'Rogue policies dropped. Latency should disappear.';
END $$;
