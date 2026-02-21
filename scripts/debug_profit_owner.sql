
SELECT get_owner_dashboard_stats('2020-01-01'::timestamptz, '2030-01-01'::timestamptz) FROM (SELECT owner_id FROM stores LIMIT 1) as x;
