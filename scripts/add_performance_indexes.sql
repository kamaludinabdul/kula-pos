-- Add indexes to improve query performance

-- Enable pg_trgm extension for fuzzy search (needed for gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Stores Table
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id);

-- 2. Profiles Table
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 3. Categories Table
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);

-- 4. Products Table
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops); -- Requires pg_trgm extension if fuzzy search is needed

-- 5. Transactions Table
CREATE INDEX IF NOT EXISTS idx_transactions_store_id ON transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_shift_id ON transactions(shift_id);

-- 6. Customers Table
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- 7. Suppliers Table
CREATE INDEX IF NOT EXISTS idx_suppliers_store_id ON suppliers(store_id);

-- 8. Sales Targets Table
CREATE INDEX IF NOT EXISTS idx_sales_targets_store_id ON sales_targets(store_id);

-- 9. Promotions Table
CREATE INDEX IF NOT EXISTS idx_promotions_store_id ON promotions(store_id);

-- 10. Purchase Orders Table
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_id ON purchase_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);

-- 11. Custom Types/Tables from original schema
CREATE INDEX IF NOT EXISTS idx_stock_movements_store_id ON stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(date);

CREATE INDEX IF NOT EXISTS idx_shifts_store_id ON shifts(store_id);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_id ON shifts(cashier_id);
