-- Migration script: Create ai_insights table to store generated Gemini analysis

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('yearly', 'monthly')),
    period_year INT NOT NULL,
    period_month INT NOT NULL, -- 0-11 for monthly, -1 for yearly
    insight_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint to avoid duplicates for the same period
ALTER TABLE public.ai_insights 
DROP CONSTRAINT IF EXISTS unique_store_period;

ALTER TABLE public.ai_insights 
ADD CONSTRAINT unique_store_period UNIQUE (store_id, period_type, period_year, period_month);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid errors on re-run
DROP POLICY IF EXISTS "Users can manage ai insights for their stores" ON public.ai_insights;
DROP POLICY IF EXISTS "multitenant_ai_insights_policy" ON public.ai_insights;

-- Create Multi-tenant Policy
CREATE POLICY "multitenant_ai_insights_policy" 
ON public.ai_insights 
FOR ALL TO authenticated 
USING (
    store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

-- Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
