-- MASTER: get_sales_person_ranking
-- Purpose: Ranks sales people by total sales within a store for a given period
-- Reconstructed based on SalesPerformanceReport.jsx requirements

CREATE OR REPLACE FUNCTION public.get_sales_person_ranking(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
    sales_person_id UUID,
    sales_person_name TEXT,
    total_sales NUMERIC,
    total_discount NUMERIC,
    transaction_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.cashier_id as sales_person_id,
        COALESCE(t.cashier, 'Unknown') as sales_person_name,
        SUM(t.total) as total_sales,
        SUM(t.discount) as total_discount,
        COUNT(t.id) as transaction_count
    FROM public.transactions t
    WHERE t.store_id = p_store_id
      AND t.date >= p_start_date
      AND t.date <= p_end_date
      AND t.status = 'completed'
    GROUP BY t.cashier_id, t.cashier
    ORDER BY total_sales DESC;
END;
$$;
