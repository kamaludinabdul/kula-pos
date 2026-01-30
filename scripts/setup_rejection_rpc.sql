-- RPC to REJECT subscription invoice
CREATE OR REPLACE FUNCTION reject_subscription_invoice(
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
    
    -- Allow re-rejecting if just updating reason, or check if already failed? 
    -- Let's allow it to update reason if needed, but primary use is fresh rejection.
    -- IF v_invoice.status = 'failed' THEN ... END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;
