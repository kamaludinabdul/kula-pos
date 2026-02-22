-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."ai_insights";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."ai_insights";
DROP POLICY IF EXISTS "Users can manage AI insights for their stores" ON public.ai_insights;

-- Enable RLS
ALTER TABLE "public"."ai_insights" ENABLE ROW LEVEL SECURITY;

-- Allow users to manage insights for stores they have access to
CREATE POLICY "Users can manage AI insights for their stores" ON public.ai_insights
    FOR ALL
    USING (
      store_id IN (
        SELECT store_id FROM user_stores WHERE user_id = auth.uid()
      )
    )
    WITH CHECK (
      store_id IN (
        SELECT store_id FROM user_stores WHERE user_id = auth.uid()
      )
    );
