-- Optimize Supabase Performance (Add Indexes)

-- 1. Store ID Indexes (Critical for RLS and Tenancy)
-- Most queries filter by store_id first. Indexing this is the #1 performance win.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_store_id ON transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_store_id ON stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_shifts_store_id ON shifts(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_store_id ON cash_flow(store_id);

-- 2. Sorting & Range Filter Indexes
-- Queries often sort by date or created_at.
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(date DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON cash_flow(date DESC);

-- 3. Search Indexes (Partial Matches)
-- Allow faster searching by name or barcode
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- 4. Foreign Key Indexes are usually auto-created? No, in Postgres they are NOT auto-indexed.
-- Indexing FKs helps with JOINS.
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);

-- 5. Analyze tables to update statistics for the query planner
ANALYZE products;
ANALYZE transactions;
ANALYZE customers;
ANALYZE stock_movements;
