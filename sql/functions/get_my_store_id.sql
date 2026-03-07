-- MASTER: get_my_store_id
-- Purpose: Helper function to get the current user's store_id from their profile
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.get_my_store_id()
RETURNS UUID AS $$
  SELECT store_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;
