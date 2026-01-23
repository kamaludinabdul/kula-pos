-- Comprehensive Fix for Inventory and Data Access Issues
-- This script applies SECURITY DEFINER to RPC functions and ensures RLS policies are robust.

-- 1. Apply SECURITY DEFINER to all major RPC functions
-- This allows them to bypass RLS and use their internal store_id filtering logic.

ALTER FUNCTION get_store_initial_snapshot(UUID) SECURITY DEFINER;
ALTER FUNCTION get_dashboard_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) SECURITY DEFINER;
ALTER FUNCTION get_shift_summary(UUID, UUID) SECURITY DEFINER;
ALTER FUNCTION bulk_update_stock(UUID, JSONB) SECURITY DEFINER;
ALTER FUNCTION process_opname_session(UUID, TEXT, JSONB) SECURITY DEFINER;
ALTER FUNCTION recalculate_product_stats(UUID) SECURITY DEFINER;
ALTER FUNCTION void_transaction(UUID, TEXT, TEXT, TEXT) SECURITY DEFINER;
ALTER FUNCTION process_sale(UUID, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, UUID, JSONB, NUMERIC, UUID, TIMESTAMPTZ, NUMERIC) SECURITY DEFINER;
ALTER FUNCTION get_products_page(UUID, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT) SECURITY DEFINER;

-- 2. Ensure RLS Policies are robust for direct Table Access
-- We use a standardized policy for multitenancy.

DO $$ 
DECLARE 
    tbl_name TEXT;
    target_tables TEXT[] := ARRAY[
        'categories', 
        'products', 
        'stock_movements', 
        'stock_opname_sessions', 
        'transactions',
        'customers',
        'suppliers',
        'promotions',
        'purchase_orders',
        'sales_targets'
    ];
BEGIN 
    FOREACH tbl_name IN ARRAY target_tables 
    LOOP 
        BEGIN
            -- Drop existing multitenant policies if they exist (to avoid conflicts)
            EXECUTE format('DROP POLICY IF EXISTS "Users can view their store %I" ON %I;', tbl_name, tbl_name);
            EXECUTE format('DROP POLICY IF EXISTS "Users can manage their store %I" ON %I;', tbl_name, tbl_name);
            EXECUTE format('DROP POLICY IF EXISTS multitenant_%I_policy ON %I;', tbl_name, tbl_name);
            
            -- Create robust policy: check store_id against user's profile
            EXECUTE format('
                CREATE POLICY multitenant_%I_policy ON %I
                FOR ALL TO authenticated
                USING (
                    EXISTS (
                        SELECT 1 FROM profiles 
                        WHERE profiles.id = auth.uid() 
                        AND (profiles.role = ''super_admin'' OR profiles.store_id = %I.store_id)
                    )
                )
                WITH CHECK (
                    EXISTS (
                        SELECT 1 FROM profiles 
                        WHERE profiles.id = auth.uid() 
                        AND (profiles.role = ''super_admin'' OR profiles.store_id = %I.store_id)
                    )
                );', tbl_name, tbl_name, tbl_name, tbl_name);
                
            -- Ensure RLS is enabled
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl_name);
        EXCEPTION WHEN undefined_table THEN
            RAISE NOTICE 'Skipping table %: does not exist', tbl_name;
        END;
    END LOOP;
END $$;

-- 3. Verification Queries
-- Run these to check if data is now accessible

-- Check if any categories have product counts
SELECT 
    c.name as category_name,
    c.store_id,
    (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_deleted = false) as product_count
FROM categories c
LIMIT 10;

-- Check if stock movements exist
SELECT COUNT(*) as movement_count FROM stock_movements;

-- Check if stock opnames exist
SELECT COUNT(*) as opname_count FROM stock_opname_sessions;
