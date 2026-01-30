-- Add rejection_reason column to subscription_invoices
ALTER TABLE subscription_invoices 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
