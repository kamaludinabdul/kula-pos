-- MASTER: void_transaction
-- Purpose: Cancel transaction with stock return and debt reversal

CREATE OR REPLACE FUNCTION public.void_transaction(
    p_store_id UUID,
    p_transaction_id TEXT,
    p_reason TEXT,
    p_void_by TEXT
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item RECORD;
    v_trans_record RECORD;
BEGIN
    SELECT * INTO v_trans_record FROM public.transactions WHERE id = p_transaction_id AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan'); END IF;
    IF v_trans_record.status = 'void' THEN RETURN jsonb_build_object('success', false, 'error', 'Transaksi sudah dibatalkan sebelumnya'); END IF;

    UPDATE public.transactions SET status = 'void', void_reason = p_reason, voided_at = NOW(), void_by = p_void_by WHERE id = p_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_trans_record.items) AS x(id TEXT, qty NUMERIC, price NUMERIC, stock_deducted BOOLEAN)
    LOOP
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND COALESCE(v_item.stock_deducted, true) IS TRUE THEN
            UPDATE public.products SET stock = stock + v_item.qty, sold = sold - v_item.qty, revenue = revenue - (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'in', v_item.qty, NOW(), 'Void Transaksi #' || right(p_transaction_id, 6), p_transaction_id);
        END IF;
    END LOOP;

    IF v_trans_record.customer_id IS NOT NULL THEN
        UPDATE public.customers SET total_spent = GREATEST(0, total_spent - v_trans_record.total), loyalty_points = GREATEST(0, loyalty_points - COALESCE(v_trans_record.points_earned, 0)),
            debt = CASE WHEN v_trans_record.payment_method = 'debt' THEN GREATEST(0, debt - v_trans_record.total) ELSE debt END
        WHERE id = v_trans_record.customer_id AND store_id = p_store_id;
        DELETE FROM loyalty_history WHERE transaction_id = p_transaction_id AND store_id = p_store_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);
END;
$$;
