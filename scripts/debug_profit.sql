
SELECT get_dashboard_stats((SELECT id::text FROM stores LIMIT 1), '2020-01-01'::timestamptz, '2030-01-01'::timestamptz);
