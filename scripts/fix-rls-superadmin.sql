-- Fix RLS Policies to Allow Super Admin Access to All Data
-- Currently, RLS restricts access to 'get_my_store_id()', which breaks direct table queries 
-- for Super Admins viewing stores other than their own.

-- 1. Ensure is_super_admin function exists and is secure
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update Policies for key tables accessed directly by frontend
DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY[
        'categories', 'products', 'transactions', 'customers', 
        'point_adjustments', 'suppliers', 'sales_targets', 'promotions',
        'purchase_orders', 'shifts', 'shift_movements', 'bookings',
        'cash_flow', 'audit_logs', 'shopping_recommendations', 
        'rental_units', 'rental_sessions', 'stock_movements', 'batches',
        'stock_opname_sessions'
    ];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables 
    LOOP 
        EXECUTE format('
            DROP POLICY IF EXISTS multitenant_%I_policy ON %I;
            CREATE POLICY multitenant_%I_policy ON %I
            FOR ALL USING (
                store_id = get_my_store_id() OR is_super_admin()
            );', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;
