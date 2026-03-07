-- MASTER: reupload_payment_proof
-- Purpose: Allow owners to re-upload payment proofs for rejected subscription invoices
-- Source: scripts/setup_reupload_rpc.sql

CREATE OR REPLACE FUNCTION public.reupload_payment_proof(
    p_invoice_id UUID,
    p_proof_url TEXT
) RETURNS JSONB AS $$
DECLARE
    v_store_id UUID;
    v_user_store_id UUID;
    v_current_status TEXT;
BEGIN
    v_user_store_id := get_my_store_id();
    
    SELECT store_id, status INTO v_store_id, v_current_status
    FROM public.subscription_invoices
    WHERE id = p_invoice_id;

    IF v_store_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invoice not found');
    END IF;

    IF v_store_id IS DISTINCT FROM v_user_store_id THEN
         RETURN jsonb_build_object('success', false, 'message', 'Unauthorized access to this invoice');
    END IF;

    UPDATE public.subscription_invoices
    SET proof_url = p_proof_url,
        status = 'pending',
        rejection_reason = NULL,
        created_at = NOW() 
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
