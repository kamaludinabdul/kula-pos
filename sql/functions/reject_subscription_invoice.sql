-- MASTER: reject_subscription_invoice
-- Purpose: Admin tool to reject a subscription payment proof
-- Source: scripts/setup_rejection_rpc.sql

CREATE OR REPLACE FUNCTION public.reject_subscription_invoice(
    p_invoice_id UUID,
    p_admin_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_invoice RECORD;
BEGIN
    -- 1. Fetch Invoice
    SELECT * INTO v_invoice FROM subscription_invoices WHERE id = p_invoice_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF v_invoice.status = 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot reject: Invoice already approved');
    END IF;

    -- 2. Update Invoice Status to 'failed'
    UPDATE subscription_invoices
    SET status = 'failed',
        approved_at = NOW(),
        approved_by = p_admin_id,
        rejection_reason = p_reason
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
