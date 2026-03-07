-- MASTER: process_refund
-- Purpose: Handle product returns and refunds

CREATE OR REPLACE FUNCTION public.process_refund(
    p_store_id UUID,
    p_transaction_id TEXT,
    p_reason TEXT,
    p_refund_by TEXT
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item RECORD;
    v_trans_record RECORD;
BEGIN
    SELECT * INTO v_trans_record FROM public.transactions WHERE id = p_transaction_id AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Transaction not found'); END IF;
    IF v_trans_record.status = 'refunded' THEN RETURN jsonb_build_object('success', false, 'error', 'Transaction already refunded'); END IF;

    UPDATE public.transactions SET status = 'refunded', refund_reason = p_reason, refunded_at = NOW(), refund_by = p_refund_by WHERE id = p_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_trans_record.items) AS x(id TEXT, qty NUMERIC, price NUMERIC)
    LOOP
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            UPDATE public.products SET stock = stock + v_item.qty, sold = sold - v_item.qty, revenue = revenue - (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;
            INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'in', v_item.qty, NOW(), 'Refund Transaksi #' || right(p_transaction_id, 6), p_transaction_id);
        END IF;
    END LOOP;

    IF v_trans_record.customer_id IS NOT NULL THEN
        UPDATE public.customers SET total_spent = GREATEST(0, total_spent - v_trans_record.total), loyalty_points = GREATEST(0, loyalty_points - COALESCE(v_trans_record.points_earned, 0))
        WHERE id = v_trans_record.customer_id AND store_id = p_store_id;
        INSERT INTO loyalty_history (store_id, customer_id, points, description, transaction_id, date)
        VALUES (p_store_id, v_trans_record.customer_id, -COALESCE(v_trans_record.points_earned, 0), 'Refund Transaksi #' || p_transaction_id, p_transaction_id, NOW());
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);
END;
$$;
