-- TEMPORARY OPEN ACCESS (DEBUGGING ONLY)
-- This removes all RLS blocks to see if the data appears.
-- If data appears after running this, we know the issue is definitely the RLS Policies.

BEGIN;

-- 1. Grant full access to authenticated users for key tables
DROP POLICY IF EXISTS "Emergency Access" ON products;
CREATE POLICY "Emergency Access" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Emergency Access" ON categories;
CREATE POLICY "Emergency Access" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Emergency Access" ON stock_movements;
CREATE POLICY "Emergency Access" ON stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Emergency Access" ON stock_opname_sessions;
CREATE POLICY "Emergency Access" ON stock_opname_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
