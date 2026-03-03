-- Migration for Enhanced Loyalty System (Poin Per Produk + Stamp Card)

-- 1. Table for Loyalty Point Rules and Stamp Cards
CREATE TABLE IF NOT EXISTS loyalty_product_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('per_product', 'stamp_card')),
    name TEXT,                          -- e.g. "Stamp Grooming"
    product_ids UUID[] NOT NULL,        -- eligible product IDs
    points_per_item INTEGER DEFAULT 0,  -- for per_product: points per qty
    stamp_target INTEGER DEFAULT 10,    -- for stamp_card: stamps needed
    stamp_reward_points INTEGER DEFAULT 0, -- for stamp_card: bonus points on completion
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by store
CREATE INDEX IF NOT EXISTS idx_loyalty_product_rules_store_id ON loyalty_product_rules(store_id);

-- Enable RLS for loyalty_product_rules
ALTER TABLE loyalty_product_rules ENABLE ROW LEVEL SECURITY;

-- 2. Table for Customer Stamp Tracking
CREATE TABLE IF NOT EXISTS customer_stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES loyalty_product_rules(id) ON DELETE CASCADE,
    current_stamps INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,   -- how many times card was completed
    last_stamped_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(customer_id, rule_id)
);

-- Index for fast lookup by customer
CREATE INDEX IF NOT EXISTS idx_customer_stamps_customer_id ON customer_stamps(customer_id);

-- Enable RLS for customer_stamps
ALTER TABLE customer_stamps ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DO $$ 
BEGIN 
    -- loyalty_product_rules policies
    DROP POLICY IF EXISTS "loyalty_product_rules_policy" ON loyalty_product_rules;
    CREATE POLICY "loyalty_product_rules_policy" ON loyalty_product_rules
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin') 
        OR store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
    ) WITH CHECK (
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin') 
        OR store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
    );

    -- customer_stamps policies (depends on customer's store_id)
    DROP POLICY IF EXISTS "customer_stamps_policy" ON customer_stamps;
    CREATE POLICY "customer_stamps_policy" ON customer_stamps
    FOR ALL USING (
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin') 
        OR customer_id IN (
            SELECT id FROM customers WHERE store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
        )
    ) WITH CHECK (
        auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin') 
        OR customer_id IN (
            SELECT id FROM customers WHERE store_id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
        )
    );
END $$;

-- Add comments
COMMENT ON TABLE loyalty_product_rules IS 'Enhanced Loyalty System: Rules for per-product points and stamp cards';
COMMENT ON TABLE customer_stamps IS 'Enhanced Loyalty System: Tracks customer stamp progress';

-- 4. Function to Redeem Stamp Cards
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
        last_stamped_at = NOW()
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
