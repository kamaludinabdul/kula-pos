-- Compare shifts.total_sales vs sum(transactions.total)
WITH store_info AS (
    SELECT id FROM stores WHERE email = 'rhpetshop25@gmail.com' LIMIT 1
)
SELECT 
    s.id as shift_id,
    s.start_time,
    s.end_time,
    s.total_sales as shift_table_total,
    (SELECT SUM(total) FROM transactions t WHERE t.shift_id = s.id AND t.status = 'completed') as transaction_sum_total,
    s.total_cash_sales as shift_table_cash,
    (SELECT SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) FROM transactions t WHERE t.shift_id = s.id AND t.status = 'completed') as transaction_sum_cash
FROM shifts s
JOIN store_info si ON s.store_id = si.id
ORDER BY s.start_time DESC
LIMIT 5;
