-- Fix transactions missing buy_price in items
-- This updates imported transactions to include buy_price from products table

-- First, let's see the affected transactions
SELECT 
    t.id,
    t.date,
    t.total,
    t.items,
    (t.items->0->>'name') as product_name,
    (t.items->0->>'price')::numeric as sell_price,
    (t.items->0->>'buy_price')::numeric as current_buy_price
FROM transactions t
WHERE t.store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid
  AND t.date >= '2026-01-16'
  AND (t.items->0->>'buy_price') IS NULL
ORDER BY t.date DESC
LIMIT 10;

-- To fix: Run this UPDATE to add buy_price from products table
-- This uses the product ID stored in items to lookup the buy_price

UPDATE transactions t
SET items = (
    SELECT jsonb_agg(
        item || jsonb_build_object('buy_price', COALESCE(p.buy_price, 0))
    )
    FROM jsonb_array_elements(t.items) AS item
    LEFT JOIN products p ON (item->>'id')::uuid = p.id
)
WHERE t.store_id = 'b5b56789-1960-7bd0-1f54-abee9db1ee37'::uuid
  AND t.date >= '2026-01-16'
  AND (t.items->0->>'buy_price') IS NULL;
