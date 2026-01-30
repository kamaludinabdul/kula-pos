-- Trigger function to sync Owner's plan to all their stores
-- This ensures that if an Owner upgrades, all their stores (and thus Staff) get the benefits immediately.
-- Also ensures legacy code relying on 'stores.plan' continues to work.

CREATE OR REPLACE FUNCTION sync_owner_plan_to_stores()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if plan details changed
    IF OLD.plan IS DISTINCT FROM NEW.plan OR OLD.plan_expiry_date IS DISTINCT FROM NEW.plan_expiry_date THEN
        UPDATE stores
        SET 
            plan = NEW.plan,
            plan_expiry_date = NEW.plan_expiry_date
        WHERE owner_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists to allow clean recreate
DROP TRIGGER IF EXISTS trigger_sync_owner_plan ON profiles;

CREATE TRIGGER trigger_sync_owner_plan
AFTER UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION sync_owner_plan_to_stores();
