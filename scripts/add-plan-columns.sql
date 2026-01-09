-- Add missing columns to subscription_plans table for PlanManagement.jsx

ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS price NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_price NUMERIC(15, 2);

-- Update default values
UPDATE subscription_plans SET price = 0 WHERE id = 'free';
UPDATE subscription_plans SET price = 0 WHERE id = 'pro'; -- Set actual price as needed
UPDATE subscription_plans SET price = 0 WHERE id = 'enterprise';
