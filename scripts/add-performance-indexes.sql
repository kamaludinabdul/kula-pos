-- Performance Optimization: Add Indexes for RLS and Common Queries

-- 1. Foreign Key Indexes (Improve JOIN performance)
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_store_id ON transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift_id ON transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_users_store_id ON profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_id ON purchase_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rental_units_store_id ON rental_units(store_id);
CREATE INDEX IF NOT EXISTS idx_rental_sessions_store_id ON rental_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_shifts_store_id ON shifts(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_store_id ON stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);

-- 2. Performance Filter Indexes (Improve WHERE clause performance)
-- Products: Often filtered by is_deleted and barcode
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Transactions: Often filtered by date (Range queries for dashboards)
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);

-- Shifts: Often filtered by status (open/closed)
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- Profiles: Typically queried by email during auth
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 3. Composite Indexes for very common specific queries
-- Dashboard often queries transactions by store AND date
CREATE INDEX IF NOT EXISTS idx_transactions_store_date ON transactions(store_id, date DESC);

-- Product Search often filters by store AND name/barcode
CREATE INDEX IF NOT EXISTS idx_products_store_search ON products(store_id, name, barcode) WHERE is_deleted = false;
