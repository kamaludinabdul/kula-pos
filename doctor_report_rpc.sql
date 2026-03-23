-- RPC for Doctor Commission Report
CREATE OR REPLACE FUNCTION get_doctor_commission_report(
    p_store_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    doctor_id UUID,
    doctor_name TEXT,
    total_items BIGINT,
    total_commission NUMERIC,
    item_details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ti.doctor_id,
        pr.name as doctor_name,
        COUNT(ti.id) as total_items,
        SUM(ti.doctor_commission_amount) as total_commission,
        jsonb_agg(jsonb_build_object(
            'transaction_id', t.id,
            'date', t.date,
            'item_name', ti.name,
            'price', ti.price,
            'qty', ti.qty,
            'commission', ti.doctor_commission_amount,
            'patient_name', t.patient_name
        ) ORDER BY t.date DESC) as item_details
    FROM transaction_items ti
    JOIN transactions t ON ti.transaction_id = t.id
    JOIN profiles pr ON ti.doctor_id = pr.id
    WHERE t.store_id = p_store_id
      AND t.date >= p_start_date
      AND t.date <= p_end_date
      AND ti.doctor_id IS NOT NULL
    GROUP BY ti.doctor_id, pr.name;
END;
$$ LANGUAGE plpgsql;
