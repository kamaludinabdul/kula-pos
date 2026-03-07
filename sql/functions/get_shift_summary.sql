-- MASTER: get_shift_summary
-- Purpose: Calculate accurate shift performance metrics

CREATE OR REPLACE FUNCTION public.get_shift_summary(
    p_store_id UUID,
    p_shift_id UUID
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'transactions', COALESCE(COUNT(*), 0),
        'totalSales', COALESCE(SUM(total), 0),
        'totalCashSales', COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total WHEN payment_method = 'split' AND payment_details->>'method1' = 'cash' THEN (payment_details->>'amount1')::NUMERIC WHEN payment_method = 'split' AND payment_details->>'method2' = 'cash' THEN (payment_details->>'amount2')::NUMERIC ELSE 0 END), 0),
        'totalNonCashSales', COALESCE(SUM(CASE WHEN payment_method != 'cash' AND payment_method != 'split' THEN total WHEN payment_method = 'split' THEN (CASE WHEN payment_details->>'method1' != 'cash' THEN (payment_details->>'amount1')::NUMERIC ELSE 0 END) + (CASE WHEN payment_details->>'method2' != 'cash' THEN (payment_details->>'amount2')::NUMERIC ELSE 0 END) ELSE 0 END), 0),
        'totalDiscount', COALESCE(SUM(discount), 0)
    ) INTO v_summary
    FROM transactions WHERE store_id = p_store_id AND shift_id = p_shift_id AND status = 'completed';
    RETURN v_summary;
END;
$$;
