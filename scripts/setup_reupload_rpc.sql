-- =====================================================================================
-- RE-UPLOAD PROOF RPC
-- =====================================================================================
-- This function allows store owners to re-upload payment proofs for rejected invoices.
-- It bypasses the standard RLS that blocks UPDATEs on subscription_invoices.

CREATE OR REPLACE FUNCTION public.reupload_payment_proof(
    p_invoice_id UUID,
    p_proof_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_store_id UUID;
    v_user_store_id UUID;
    v_current_status TEXT;
BEGIN
    -- 1. Get current user's store ID using the helper (assumes auth context)
    v_user_store_id := get_my_store_id();
    
    -- 2. Check if invoice exists and verify ownership
    SELECT store_id, status INTO v_store_id, v_current_status
    FROM public.subscription_invoices
    WHERE id = p_invoice_id;

    IF v_store_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invoice not found');
    END IF;

    IF v_store_id IS DISTINCT FROM v_user_store_id THEN
         RETURN jsonb_build_object('success', false, 'message', 'Unauthorized access to this invoice');
    END IF;

    -- 3. Update the invoice
    -- We reset status to 'pending', update the proof URL, and clear the rejection reason.
    -- We also update created_at to bring it to the attention of admins (sort by new).
    UPDATE public.subscription_invoices
    SET 
        proof_url = p_proof_url,
        status = 'pending',
        rejection_reason = NULL,
        created_at = NOW() 
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
