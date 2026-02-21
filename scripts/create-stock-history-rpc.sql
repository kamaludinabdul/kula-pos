-- Create a Security Definer RPC for fetching stock history
-- This bypasses restrictive RLS for owners while maintaining data integrity

CREATE OR REPLACE FUNCTION get_stock_history(
    p_store_id UUID,
    p_product_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 500
) RETURNS JSONB
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(row_to_json(sm)::jsonb) INTO v_result
    FROM (
        SELECT * FROM stock_movements
        WHERE store_id = p_store_id
        AND (p_product_id IS NULL OR product_id = p_product_id)
        ORDER BY date DESC
        LIMIT p_limit
    ) sm;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_stock_history(UUID, UUID, INT) TO authenticated;
