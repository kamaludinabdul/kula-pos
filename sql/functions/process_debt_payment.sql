-- MASTER: process_debt_payment
-- Purpose: Record payment towards customer debt and create transaction log
-- Source: supabase_schema.sql

CREATE OR REPLACE FUNCTION public.process_debt_payment(
    p_store_id UUID,
    p_customer_id TEXT,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    v_new_transaction_id TEXT;
BEGIN
    -- 1. Create Transaction ID
    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    -- 2. Insert Transaction Record
    INSERT INTO transactions (id, store_id, customer_id, type, total, payment_method, date, status, items)
    VALUES (v_new_transaction_id, p_store_id, p_customer_id, 'debt_payment', p_amount, p_payment_method, p_date, 'completed', '[]');

    -- 3. Update Customer Debt
    UPDATE customers
    SET debt = debt - p_amount
    WHERE id = p_customer_id AND store_id = p_store_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
