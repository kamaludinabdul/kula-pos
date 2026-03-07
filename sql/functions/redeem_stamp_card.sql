-- MASTER: redeem_stamp_card
-- Purpose: Process stamp card redemption and award loyalty points
-- Source: redeem_stamp.sql

CREATE OR REPLACE FUNCTION public.redeem_stamp_card(
    p_stamp_id uuid,
    p_customer_id uuid,
    p_target_stamps int,
    p_reward_points int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_stamps int;
    v_completed_count int;
    v_store_id uuid;
BEGIN
    -- Get current stamp card values and store ID
    SELECT cs.current_stamps, cs.completed_count, c.store_id 
    INTO v_current_stamps, v_completed_count, v_store_id
    FROM public.customer_stamps cs
    JOIN public.customers c ON c.id = cs.customer_id
    WHERE cs.id = p_stamp_id AND cs.customer_id = p_customer_id
    FOR UPDATE OF cs;

    IF v_current_stamps < p_target_stamps THEN
        RAISE EXCEPTION 'Not enough stamps to redeem (Current: %, Target: %)', v_current_stamps, p_target_stamps;
    END IF;

    -- Update stamp card
    UPDATE public.customer_stamps
    SET 
        current_stamps = current_stamps - p_target_stamps,
        completed_count = COALESCE(completed_count, 0) + 1,
        updated_at = NOW()
    WHERE id = p_stamp_id;

    -- Update customer loyalty points
    UPDATE public.customers
    SET loyalty_points = COALESCE(loyalty_points, 0) + p_reward_points
    WHERE id = p_customer_id;

    -- Optional: log to point_adjustment_history
    INSERT INTO public.point_adjustment_history (
        store_id, customer_id, points_changed, reason, created_at
    )
    VALUES (
        v_store_id, p_customer_id, p_reward_points, 'Menukar Kartu Stamp', NOW()
    );

    RETURN true;
END;
$$;
