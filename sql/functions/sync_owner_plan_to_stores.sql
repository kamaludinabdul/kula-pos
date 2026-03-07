-- MASTER: sync_owner_plan_to_stores
-- Purpose: Syncs the Owner's plan and expiry date from their profile to ALL their stores
-- Source: scripts/sync-owner-plan-to-stores.sql

CREATE OR REPLACE FUNCTION public.sync_owner_plan_to_stores()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Only update stores if plan or expiry date changed in the profile
    IF OLD.plan IS DISTINCT FROM NEW.plan OR OLD.plan_expiry_date IS DISTINCT FROM NEW.plan_expiry_date THEN
        UPDATE public.stores
        SET 
            plan = NEW.plan,
            plan_expiry_date = NEW.plan_expiry_date
        WHERE owner_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
