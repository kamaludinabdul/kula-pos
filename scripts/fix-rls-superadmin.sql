-- Fix RLS policies to allow super_admin full access

-- 1. Create helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Update stores policy to allow super_admin
DROP POLICY IF EXISTS multitenant_stores_policy ON stores;
CREATE POLICY multitenant_stores_policy ON stores
FOR ALL USING (
    is_super_admin() OR
    owner_id = auth.uid() OR 
    id = get_my_store_id()
) WITH CHECK (
    is_super_admin() OR
    owner_id = auth.uid()
);

-- 3. Update profiles policy to allow super_admin
DROP POLICY IF EXISTS multitenant_profiles_policy ON profiles;
CREATE POLICY multitenant_profiles_policy ON profiles
FOR ALL USING (
    is_super_admin() OR
    id = auth.uid() OR 
    store_id = get_my_store_id()
) WITH CHECK (
    is_super_admin() OR
    id = auth.uid() OR 
    store_id = get_my_store_id()
);

-- 4. Update other tables to allow super_admin

-- Categories
DROP POLICY IF EXISTS multitenant_categories ON categories;
DROP POLICY IF EXISTS multitenant_categories_policy ON categories;
CREATE POLICY multitenant_categories ON categories
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Products
DROP POLICY IF EXISTS multitenant_products ON products;
DROP POLICY IF EXISTS multitenant_products_policy ON products;
CREATE POLICY multitenant_products ON products
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Customers
DROP POLICY IF EXISTS multitenant_customers ON customers;
DROP POLICY IF EXISTS multitenant_customers_policy ON customers;
CREATE POLICY multitenant_customers ON customers
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Transactions
DROP POLICY IF EXISTS multitenant_transactions ON transactions;
DROP POLICY IF EXISTS multitenant_transactions_policy ON transactions;
CREATE POLICY multitenant_transactions ON transactions
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Suppliers
DROP POLICY IF EXISTS multitenant_suppliers ON suppliers;
DROP POLICY IF EXISTS multitenant_suppliers_policy ON suppliers;
CREATE POLICY multitenant_suppliers ON suppliers
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Purchase Orders
DROP POLICY IF EXISTS multitenant_purchase_orders ON purchase_orders;
DROP POLICY IF EXISTS multitenant_purchase_orders_policy ON purchase_orders;
CREATE POLICY multitenant_purchase_orders ON purchase_orders
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Shifts
DROP POLICY IF EXISTS multitenant_shifts ON shifts;
DROP POLICY IF EXISTS multitenant_shifts_policy ON shifts;
CREATE POLICY multitenant_shifts ON shifts
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Rental Units
DROP POLICY IF EXISTS multitenant_rental_units ON rental_units;
DROP POLICY IF EXISTS multitenant_rental_units_policy ON rental_units;
CREATE POLICY multitenant_rental_units ON rental_units
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Rental Sessions
DROP POLICY IF EXISTS multitenant_rental_sessions ON rental_sessions;
DROP POLICY IF EXISTS multitenant_rental_sessions_policy ON rental_sessions;
CREATE POLICY multitenant_rental_sessions ON rental_sessions
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Bookings
DROP POLICY IF EXISTS multitenant_bookings ON bookings;
DROP POLICY IF EXISTS multitenant_bookings_policy ON bookings;
CREATE POLICY multitenant_bookings ON bookings
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Cash Flow
DROP POLICY IF EXISTS multitenant_cash_flow ON cash_flow;
DROP POLICY IF EXISTS multitenant_cash_flow_policy ON cash_flow;
CREATE POLICY multitenant_cash_flow ON cash_flow
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Stock Movements
DROP POLICY IF EXISTS multitenant_stock_movements ON stock_movements;
DROP POLICY IF EXISTS multitenant_stock_movements_policy ON stock_movements;
CREATE POLICY multitenant_stock_movements ON stock_movements
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Rooms
DROP POLICY IF EXISTS multitenant_rooms ON rooms;
DROP POLICY IF EXISTS multitenant_rooms_policy ON rooms;
CREATE POLICY multitenant_rooms ON rooms
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Pets
DROP POLICY IF EXISTS multitenant_pets ON pets;
DROP POLICY IF EXISTS multitenant_pets_policy ON pets;
CREATE POLICY multitenant_pets ON pets
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- Medical Records
DROP POLICY IF EXISTS multitenant_medical_records ON medical_records;
DROP POLICY IF EXISTS multitenant_medical_records_policy ON medical_records;
CREATE POLICY multitenant_medical_records ON medical_records
FOR ALL USING (is_super_admin() OR store_id = get_my_store_id())
WITH CHECK (is_super_admin() OR store_id = get_my_store_id());

-- 5. FIX: Reset empty permissions to NULL to restore role-based defaults
UPDATE public.profiles 
SET permissions = NULL 
WHERE permissions = '[]'::jsonb;
