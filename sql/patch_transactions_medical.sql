-- Patch to add missing columns to transactions table for Medical Records integration
ALTER TABLE public.transactions
-- Link to the original medical record
ADD COLUMN IF NOT EXISTS medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
-- Store the patient name directly for easier display in receipts/reports without complex joins
ADD COLUMN IF NOT EXISTS patient_name TEXT;
