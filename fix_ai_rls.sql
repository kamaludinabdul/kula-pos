-- For ai_insights table
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view AI insights for their stores" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can insert AI insights for their stores" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can update AI insights for their stores" ON public.ai_insights;

CREATE POLICY "Users can view AI insights for their stores"
    ON public.ai_insights FOR SELECT
    USING (store_id IN (SELECT store_id FROM user_stores WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert AI insights for their stores"
    ON public.ai_insights FOR INSERT
    WITH CHECK (store_id IN (SELECT store_id FROM user_stores WHERE user_id = auth.uid()));

CREATE POLICY "Users can update AI insights for their stores"
    ON public.ai_insights FOR UPDATE
    USING (store_id IN (SELECT store_id FROM user_stores WHERE user_id = auth.uid()))
    WITH CHECK (store_id IN (SELECT store_id FROM user_stores WHERE user_id = auth.uid()));
