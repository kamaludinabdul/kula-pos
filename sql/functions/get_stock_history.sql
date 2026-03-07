-- MASTER: get_stock_history
-- Purpose: Audit-safe retrieval of stock movement history

CREATE OR REPLACE FUNCTION public.get_stock_history(
    p_store_id UUID,
    p_product_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 500
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
    SELECT jsonb_agg(row_to_json(sm)::jsonb) INTO v_result FROM (SELECT * FROM stock_movements WHERE store_id = p_store_id AND (p_product_id IS NULL OR product_id = p_product_id) ORDER BY date DESC LIMIT p_limit) sm;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
