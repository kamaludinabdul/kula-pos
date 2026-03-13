-- Add business_type column to subscription_plans
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'general';

-- Update existing plans to be 'general' (default)
UPDATE subscription_plans SET business_type = 'general' WHERE business_type IS NULL;

-- Create pharmacy-specific plans if they don't exist
-- We use a prefix or different IDs to distinguish them if needed, 
-- but since 'id' is likely the primary PK (free, pro, enterprise), 
-- we might either need a composite PK (id, business_type) or unique IDs like 'pharmacy_free'.
-- Looking at DataContext.jsx:950, it uses `plansMap[p.id]`.
-- If we want multiple 'pro' plans, we need unique IDs.

-- Option A: Unique IDs (e.g., 'pharmacy_pro')
INSERT INTO subscription_plans (id, name, business_type, price, original_price, max_products, max_staff, max_stores, features)
VALUES 
('pharmacy_free', 'Pharmacy Free', 'pharmacy', 0, 0, 100, 2, 1, '[]'),
('pharmacy_pro', 'Pharmacy Pro', 'pharmacy', 250000, 350000, -1, 10, 3, '["pharmacy.prescriptions", "pharmacy.multi_unit", "reports.profit_loss", "reports.cash_flow", "products.stock_history"]'),
('pharmacy_enterprise', 'Pharmacy Enterprise', 'pharmacy', 500000, 750000, -1, -1, 10, '["pharmacy.prescriptions", "pharmacy.multi_unit", "smart_insights", "reports.sales_forecast"]')
ON CONFLICT (id) DO UPDATE SET
    price = EXCLUDED.price,
    features = EXCLUDED.features,
    business_type = EXCLUDED.business_type;

-- Also ensure 'fnb', 'laundry', 'rental' have their base plans if necessary, 
-- or they can fallback to 'general'.
