-- For ai_insights table
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "multitenant_ai_insights_policy" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can view AI insights for their stores" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can insert AI insights for their stores" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can update AI insights for their stores" ON public.ai_insights;

CREATE POLICY "ai_insights_select_policy"
    ON public.ai_insights FOR SELECT
    USING (
      store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "ai_insights_insert_policy"
    ON public.ai_insights FOR INSERT
    WITH CHECK (
      store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );

CREATE POLICY "ai_insights_update_policy"
    ON public.ai_insights FOR UPDATE
    USING (
      store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    )
    WITH CHECK (
      store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );
