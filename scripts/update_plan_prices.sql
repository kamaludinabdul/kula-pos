-- Update Subscription Plans Prices to match requirements
-- This ensures 'Plan Management' data is correct.

DO $$
BEGIN
    -- Update PRO Plan
    UPDATE public.subscription_plans 
    SET price = 150000, 
        original_price = 250000 
    WHERE id = 'pro';

    -- Update ENTERPRISE Plan
    UPDATE public.subscription_plans 
    SET price = 350000 
    WHERE id = 'enterprise';

    -- Ensure FREE is 0
    UPDATE public.subscription_plans 
    SET price = 0 
    WHERE id = 'free';
END $$;
