-- Fix Missing RLS Policies for Core Tables
-- The fix-rls-comprehensive.sql script enabled RLS on all tables but missed creating multitenant policies for core tables.

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
                store_id = get_my_store_id()
            ) WITH CHECK (
                store_id = get_my_store_id()
            );', tbl_name, tbl_name, tbl_name, tbl_name);
    END LOOP;
END $$;
