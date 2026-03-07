-- =========================================================
-- MASTER DEPLOYMENT: ALL RPC FUNCTIONS (v1.0.0)
-- Purpose: Consolidate all core logic into a single source
-- =========================================================

BEGIN;

-- 1. UTILITIES & SECURITY
\i functions/is_super_admin.sql
\i functions/handle_new_user.sql
\i functions/get_my_store_id.sql
\i functions/check_staff_conflict.sql

-- 2. DASHBOARD & ANALYTICS
\i functions/get_dashboard_stats.sql
\i functions/get_dashboard_monthly_summary.sql
\i functions/get_owner_dashboard_stats.sql
\i functions/get_owner_daily_sales.sql
\i functions/get_owner_financial_summary.sql
\i functions/get_sales_person_ranking.sql
\i functions/get_owner_low_stock_alerts.sql

-- 3. SALES & TRANSACTIONS
\i functions/process_sale.sql
\i functions/process_refund.sql
\i functions/void_transaction.sql
\i functions/get_shift_summary.sql
\i functions/process_debt_payment.sql

-- 4. PRODUCTS & INVENTORY
\i functions/get_products_page.sql
\i functions/get_store_initial_snapshot.sql
\i functions/recalculate_product_stats.sql
\i functions/bulk_add_products.sql
\i functions/bulk_update_stock.sql
\i functions/add_stock_batch.sql
\i functions/adjust_stock.sql
\i functions/receive_purchase_order.sql
\i functions/reduce_stock_fifo.sql
\i functions/process_opname_session.sql
\i functions/get_stock_history.sql
\i functions/copy_products_to_store.sql
\i functions/add_session_item.sql
\i functions/remove_session_item.sql
\i functions/create_initial_batch.sql
\i functions/reset_store_data.sql

-- 5. REPORTS
\i functions/get_profit_loss_report.sql
\i functions/get_product_sales_report.sql
\i functions/get_shared_customers.sql

-- 6. LOYALTY & SUBSCRIPTIONS
\i functions/redeem_stamp_card.sql
\i functions/reset_loyalty_points.sql
\i functions/approve_subscription_invoice.sql
\i functions/reject_subscription_invoice.sql
\i functions/reupload_payment_proof.sql
\i functions/sync_owner_plan_to_stores.sql

-- GRANTS
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

COMMIT;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'All 41 functions deployed successfully!' as status;
