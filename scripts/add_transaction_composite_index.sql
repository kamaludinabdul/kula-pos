-- Composite Index for Transactions
-- Optimizes the most common query: store_id + date range
CREATE INDEX IF NOT EXISTS idx_transactions_store_date_composite ON transactions(store_id, date);

-- Optimizes Summary Stats (status and payment method are often filtered together)
CREATE INDEX IF NOT EXISTS idx_transactions_status_payment_composite ON transactions(status, payment_method);
