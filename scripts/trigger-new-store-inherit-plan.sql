-- Trigger to ensuring NEW stores inherit the Owner's plan immediately
CREATE OR REPLACE FUNCTION inherit_owner_plan()
RETURNS TRIGGER AS $$
DECLARE
    v_owner_plan TEXT;
    v_owner_expiry TIMESTAMPTZ;
BEGIN
    -- Fetch Owner's Plan
    SELECT plan, plan_expiry_date 
    INTO v_owner_plan, v_owner_expiry
    FROM profiles 
    WHERE id = NEW.owner_id;

    -- Assign to the new store
    IF FOUND THEN
        NEW.plan := COALESCE(v_owner_plan, 'free');
        NEW.plan_expiry_date := v_owner_expiry;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop logic for idempotency
DROP TRIGGER IF EXISTS trigger_inherit_owner_plan ON stores;

CREATE TRIGGER trigger_inherit_owner_plan
BEFORE INSERT ON stores
FOR EACH ROW
EXECUTE FUNCTION inherit_owner_plan();
