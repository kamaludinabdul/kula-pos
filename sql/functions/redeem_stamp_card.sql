-- MASTER: redeem_stamp_card
-- Purpose: Process customer stamp card redemption and award points

CREATE OR REPLACE FUNCTION public.redeem_stamp_card(
    p_stamp_id uuid,
    p_customer_id TEXT,
    p_target_stamps int,
    p_reward_points int
) RETURNS boolean 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current_stamps int; v_store_id uuid;
BEGIN
    SELECT cs.current_stamps, c.store_id INTO v_current_stamps, v_store_id FROM public.customer_stamps cs JOIN public.customers c ON c.id = cs.customer_id WHERE cs.id = p_stamp_id AND cs.customer_id = p_customer_id FOR UPDATE OF cs;
    IF v_current_stamps < p_target_stamps THEN RAISE EXCEPTION 'Not enough stamps'; END IF;
    UPDATE public.customer_stamps SET current_stamps = current_stamps - p_target_stamps, completed_count = COALESCE(completed_count, 0) + 1, last_stamped_at = NOW() WHERE id = p_stamp_id;
    UPDATE public.customers SET loyalty_points = COALESCE(loyalty_points, 0) + p_reward_points WHERE id = p_customer_id;
    RETURN true;
END;
$$;
