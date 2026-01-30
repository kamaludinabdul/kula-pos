-- RPC to approve subscription invoice and update OWNER plan (which syncs to stores)
CREATE OR REPLACE FUNCTION approve_subscription_invoice(
    p_invoice_id UUID,
    p_admin_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_invoice RECORD;
    v_store RECORD;
    v_owner_profile RECORD;
    v_new_expiry TIMESTAMPTZ;
    v_duration_interval INTERVAL;
BEGIN
    -- 1. Fetch Invoice
    SELECT * INTO v_invoice FROM subscription_invoices WHERE id = p_invoice_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF v_invoice.status = 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice already approved');
    END IF;

    -- 2. Fetch Store to identify Owner
    SELECT * INTO v_store FROM stores WHERE id = v_invoice.store_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Store not found');
    END IF;

    -- 3. Fetch Owner Profile
    SELECT * INTO v_owner_profile FROM profiles WHERE id = v_store.owner_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Owner profile not found');
    END IF;

    -- 4. Calculate New Expiry based on OWNER'S current plan
    v_duration_interval := (v_invoice.duration_months || ' months')::INTERVAL;
    
    -- Sync logic: If owner is already on same plan and not expired, extend.
    IF v_owner_profile.plan = v_invoice.plan_id AND v_owner_profile.plan_expiry_date > NOW() THEN
        v_new_expiry := v_owner_profile.plan_expiry_date + v_duration_interval;
    ELSE
        v_new_expiry := NOW() + v_duration_interval;
    END IF;

    -- 5. Update Owner Profile
    -- This will fire 'sync_owner_plan_to_stores' trigger to update ALL stores
    UPDATE profiles
    SET plan = v_invoice.plan_id,
        plan_expiry_date = v_new_expiry
    WHERE id = v_store.owner_id;

    -- 6. Update Invoice
    UPDATE subscription_invoices
    SET status = 'approved',
        approved_at = NOW(),
        approved_by = p_admin_id
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
