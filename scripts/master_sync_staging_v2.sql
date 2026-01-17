-- MASTER STAGING SYNC SCRIPT - V2
-- Use this on the Staging Supabase DB to bring it up to parity with Production fixes

BEGIN;

-----------------------------------------------------------
-- 1. BASE SCHEMA & SUBSCRIPTIONS
-----------------------------------------------------------

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS original_price NUMERIC DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_products INTEGER DEFAULT 100;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS max_staff INTEGER DEFAULT 5;
ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 30;

ALTER TABLE stores ADD COLUMN IF NOT EXISTS plan_expiry_date TIMESTAMPTZ;

-----------------------------------------------------------
-- 2. AUDIT LOGS RECREATION
-----------------------------------------------------------

DROP TABLE IF EXISTS audit_logs;
CREATE TABLE audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    store_id UUID,
    action TEXT NOT NULL,
    status TEXT DEFAULT 'success',
    user_name TEXT,
    user_role TEXT,
    store_name TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "allow_select" ON audit_logs FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-----------------------------------------------------------
-- 3. SECURITY & HELPER FUNCTIONS
-----------------------------------------------------------

-- Reinforce is_super_admin()
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-----------------------------------------------------------
-- 2. TRANSACTIONS SCHEMA UPDATES
-----------------------------------------------------------

DO $$ BEGIN
    -- Sale processing fields
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "change" NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS points_earned NUMERIC(15, 2) DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'sale';
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) DEFAULT 0;
    
    -- Void fields
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS void_by TEXT;
    
    -- Refund fields
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS refund_by TEXT;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS refund_reason TEXT;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error updating transactions schema';
END $$;

-----------------------------------------------------------
-- 3. RLS POLICIES FOR TRANSACTIONS
-----------------------------------------------------------

DROP POLICY IF EXISTS multitenant_transactions_policy ON public.transactions;
DROP POLICY IF EXISTS "transactions_select_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_policy" ON public.transactions;

CREATE POLICY "transactions_select_policy" ON public.transactions
FOR SELECT TO authenticated USING (
    store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid()) OR public.is_super_admin()
);

CREATE POLICY "transactions_insert_policy" ON public.transactions
FOR INSERT TO authenticated WITH CHECK (
    store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid()) OR public.is_super_admin()
);

CREATE POLICY "transactions_update_policy" ON public.transactions
FOR UPDATE TO authenticated USING (
    store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid()) OR public.is_super_admin()
);

-----------------------------------------------------------
-- 4. RPC HARDENING (SECURITY DEFINER)
-----------------------------------------------------------

-- 4.1 Process Sale
DO $$ BEGIN
    ALTER FUNCTION public.process_sale(
        UUID, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, NUMERIC, NUMERIC, TEXT, UUID, JSONB, NUMERIC, UUID, TIMESTAMPTZ, NUMERIC
    ) SECURITY DEFINER SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4.2 Void Transaction
DO $$ BEGIN
    ALTER FUNCTION public.void_transaction(UUID, TEXT, TEXT, TEXT) SECURITY DEFINER SET search_path = public;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4.3 Get Shift Summary (Fix calculation)
CREATE OR REPLACE FUNCTION public.get_shift_summary(
    p_store_id UUID,
    p_shift_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'transactions', COALESCE(COUNT(*), 0),
        'totalSales', COALESCE(SUM(total), 0),
        'totalCashSales', COALESCE(SUM(
            CASE 
                WHEN payment_method = 'cash' THEN total 
                WHEN payment_method = 'split' AND payment_details->>'method1' = 'cash' THEN (payment_details->>'amount1')::NUMERIC
                WHEN payment_method = 'split' AND payment_details->>'method2' = 'cash' THEN (payment_details->>'amount2')::NUMERIC
                ELSE 0 
            END
        ), 0),
        'totalNonCashSales', COALESCE(SUM(
            CASE 
                WHEN payment_method != 'cash' AND payment_method != 'split' THEN total 
                WHEN payment_method = 'split' THEN 
                    (CASE WHEN payment_details->>'method1' != 'cash' THEN (payment_details->>'amount1')::NUMERIC ELSE 0 END) +
                    (CASE WHEN payment_details->>'method2' != 'cash' THEN (payment_details->>'amount2')::NUMERIC ELSE 0 END)
                ELSE 0 
            END
        ), 0),
        'totalDiscount', COALESCE(SUM(discount), 0)
    ) INTO v_summary
    FROM transactions
    WHERE store_id = p_store_id 
      AND shift_id = p_shift_id 
      AND status = 'completed';

    RETURN v_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-----------------------------------------------------------
-- 5. NEW RPC: PROCESS REFUND
-----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_refund(
    p_store_id UUID,
    p_transaction_id TEXT,
    p_reason TEXT,
    p_refund_by TEXT
) RETURNS JSONB AS $$
DECLARE
    v_item RECORD;
    v_trans_record RECORD;
BEGIN
    SELECT * INTO v_trans_record FROM public.transactions 
    WHERE id = p_transaction_id AND store_id = p_store_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF v_trans_record.status = 'refunded' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transaction already refunded');
    END IF;

    UPDATE public.transactions 
    SET status = 'refunded',
        refund_reason = p_reason,
        refunded_at = NOW(),
        refund_by = p_refund_by
    WHERE id = p_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_trans_record.items) AS x(id TEXT, qty NUMERIC, price NUMERIC)
    LOOP
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            UPDATE public.products 
            SET stock = stock + v_item.qty,
                sold = sold - v_item.qty,
                revenue = revenue - (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'in', v_item.qty, NOW(), 'Refund Transaksi #' || right(p_transaction_id, 6), p_transaction_id);
        END IF;
    END LOOP;

    IF v_trans_record.customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET total_spent = GREATEST(0, total_spent - v_trans_record.total)
        WHERE id = v_trans_record.customer_id AND store_id = p_store_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;

NOTIFY pgrst, 'reload schema';
