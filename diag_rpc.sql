-- TEMPORARY diagnostic function to see what the database sees
CREATE OR REPLACE FUNCTION public.diag_massive_expenses(p_store_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_agg(d) INTO v_result FROM (
        SELECT id, amount, description, type, expense_group, date
        FROM cash_flow
        WHERE store_id = p_store_id
        AND date >= '2026-03-01'
        ORDER BY amount DESC
        LIMIT 10
    ) d;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
