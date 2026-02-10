-- Check data existence for Store ID: b5b56789-1960-7bd0-1f54-abee9db1ee37 (FAMS PET)

SELECT 'products' as table_name, count(*) as count FROM products WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'
UNION ALL
SELECT 'transactions', count(*) FROM transactions WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'
UNION ALL
SELECT 'customers', count(*) FROM customers WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'
UNION ALL
SELECT 'cash_flow', count(*) FROM cash_flow WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'
UNION ALL
SELECT 'shifts', count(*) FROM shifts WHERE store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37';
