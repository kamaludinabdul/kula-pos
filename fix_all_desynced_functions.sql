-- MEGA STABILIZATION SCRIPT
-- Restores all functionality lost during SQL consolidation
-- Targets: Advanced Inventory, Loyalty System, P&L Reports, Cashier Tracking

BEGIN;

-- =========================================================
-- 1. SCHEMA RESTORATION (Tables & Columns)
-- =========================================================

-- Ensure Transactions table has all required columns
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES auth.users(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS cashier_name TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS refund_by TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS refund_reason TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS void_by TEXT;

-- Ensure Batches table has expired_date
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS expired_date DATE;
CREATE INDEX IF NOT EXISTS idx_batches_expired_date ON public.batches(expired_date);

-- Ensure Shifts table has aggregation columns
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_sales NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_discount NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_cash_sales NUMERIC(15, 2) DEFAULT 0;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS total_non_cash_sales NUMERIC(15, 2) DEFAULT 0;

-- Restore Loyalty Tables
CREATE TABLE IF NOT EXISTS public.loyalty_product_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('per_product', 'stamp_card')),
    name TEXT,
    product_ids UUID[] NOT NULL,
    points_per_item INTEGER DEFAULT 0,
    stamp_target INTEGER DEFAULT 10,
    stamp_reward_points INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL REFERENCES loyalty_product_rules(id) ON DELETE CASCADE,
    current_stamps INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    last_stamped_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(customer_id, rule_id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    points NUMERIC(15, 2) NOT NULL,
    description TEXT,
    transaction_id TEXT,
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure store_id exists in loyalty_history for RLS
ALTER TABLE public.loyalty_history ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE CASCADE;

-- =========================================================
-- 2. CORE BUSINESS LOGIC (RPCs)
-- =========================================================

-- RPC: process_sale (Advanced Version)
CREATE OR REPLACE FUNCTION public.process_sale(
    p_store_id UUID,
    p_customer_id TEXT,
    p_total NUMERIC,
    p_discount NUMERIC,
    p_payment_method TEXT,
    p_items JSONB,
    p_amount_paid NUMERIC DEFAULT 0,
    p_change NUMERIC DEFAULT 0,
    p_type TEXT DEFAULT 'sale',
    p_rental_session_id UUID DEFAULT NULL,
    p_payment_details JSONB DEFAULT '{}'::jsonb,
    p_points_earned NUMERIC DEFAULT 0,
    p_shift_id UUID DEFAULT NULL,
    p_date TIMESTAMPTZ DEFAULT NOW(),
    p_subtotal NUMERIC DEFAULT NULL,
    p_cashier_id UUID DEFAULT NULL,
    p_cashier_name TEXT DEFAULT NULL
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_new_transaction_id TEXT;
    v_subtotal NUMERIC;
    v_current_stock NUMERIC;
    v_is_unlimited BOOLEAN;
    v_prod_type TEXT;
    v_customer_name TEXT := NULL;
BEGIN
    v_subtotal := COALESCE(p_subtotal, p_total + p_discount);

    IF p_customer_id IS NOT NULL THEN
        SELECT name INTO v_customer_name FROM customers WHERE id = p_customer_id AND store_id = p_store_id;
    END IF;

    v_new_transaction_id := to_char(NOW(), 'YYMMDDHH24MISS') || floor(random() * 1000)::text;

    INSERT INTO transactions (
        id, store_id, customer_id, customer_name, total, discount, subtotal, payment_method, 
        amount_paid, "change", "type", rental_session_id, payment_details, 
        items, date, status, shift_id, points_earned,
        cashier_id, cashier_name
    )
    VALUES (
        v_new_transaction_id, p_store_id, p_customer_id, v_customer_name, p_total, p_discount, v_subtotal, p_payment_method, 
        p_amount_paid, p_change, p_type, p_rental_session_id, p_payment_details, 
        p_items, p_date, 'completed', p_shift_id, p_points_earned,
        p_cashier_id, p_cashier_name
    );

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, qty NUMERIC, name TEXT, price NUMERIC, discount NUMERIC, stock_deducted BOOLEAN)
    LOOP
        IF COALESCE(v_item.stock_deducted, false) IS TRUE THEN CONTINUE; END IF;

        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            SELECT stock, COALESCE(is_unlimited, false), COALESCE(type, 'product')
            INTO v_current_stock, v_is_unlimited, v_prod_type
            FROM products WHERE id = v_item.id::UUID AND store_id = p_store_id FOR UPDATE;

            IF v_is_unlimited = false AND v_prod_type != 'service' AND v_current_stock < v_item.qty THEN
                RAISE EXCEPTION 'Stok tidak cukup: % (Sisa: %, Diminta: %)', v_item.name, v_current_stock, v_item.qty;
            END IF;

            UPDATE products 
            SET stock = stock - v_item.qty,
                sold = sold + v_item.qty,
                revenue = revenue + (v_item.qty * (v_item.price - COALESCE(v_item.discount, 0)))
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'sale', -v_item.qty, p_date, 'Penjualan #' || right(v_new_transaction_id, 6), v_new_transaction_id);
        END IF;
    END LOOP;

    IF p_customer_id IS NOT NULL THEN
        UPDATE customers
        SET total_spent = total_spent + p_total,
            loyalty_points = loyalty_points + p_points_earned,
            total_lifetime_points = total_lifetime_points + p_points_earned,
            debt = CASE WHEN p_payment_method = 'debt' THEN debt + p_total ELSE debt END
        WHERE id = p_customer_id AND store_id = p_store_id;

        IF p_points_earned > 0 THEN
            INSERT INTO loyalty_history (store_id, customer_id, points, description, transaction_id, date)
            VALUES (p_store_id, p_customer_id, p_points_earned, 'Penjualan #' || v_new_transaction_id, v_new_transaction_id, p_date);
        END IF;
    END IF;

    IF p_shift_id IS NOT NULL THEN
        UPDATE shifts SET 
            total_sales = COALESCE(total_sales, 0) + p_total,
            total_discount = COALESCE(total_discount, 0) + p_discount,
            total_cash_sales = CASE WHEN p_payment_method = 'cash' THEN COALESCE(total_cash_sales, 0) + p_total ELSE COALESCE(total_cash_sales, 0) END,
            total_non_cash_sales = CASE WHEN p_payment_method != 'cash' THEN COALESCE(total_non_cash_sales, 0) + p_total ELSE COALESCE(total_non_cash_sales, 0) END
        WHERE id = p_shift_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_new_transaction_id, 'customer_name', v_customer_name);
END;
$$;

-- RPC: void_transaction (FIFO/Batch Aware)
CREATE OR REPLACE FUNCTION public.void_transaction(
    p_store_id UUID,
    p_transaction_id TEXT,
    p_reason TEXT,
    p_void_by TEXT
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item RECORD;
    v_trans_record RECORD;
BEGIN
    SELECT * INTO v_trans_record FROM public.transactions WHERE id = p_transaction_id AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Transaksi tidak ditemukan'); END IF;
    IF v_trans_record.status = 'void' THEN RETURN jsonb_build_object('success', false, 'error', 'Transaksi sudah dibatalkan'); END IF;

    UPDATE public.transactions SET status = 'void', void_reason = p_reason, voided_at = NOW(), void_by = p_void_by WHERE id = p_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_trans_record.items) AS x(id TEXT, qty NUMERIC, price NUMERIC, stock_deducted BOOLEAN)
    LOOP
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND COALESCE(v_item.stock_deducted, true) IS TRUE THEN
            UPDATE public.products SET stock = stock + v_item.qty, sold = sold - v_item.qty, revenue = revenue - (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;

            INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'in', v_item.qty, NOW(), 'Void #' || right(p_transaction_id, 6), p_transaction_id);
        END IF;
    END LOOP;

    IF v_trans_record.customer_id IS NOT NULL THEN
        UPDATE public.customers SET total_spent = GREATEST(0, total_spent - v_trans_record.total), loyalty_points = GREATEST(0, loyalty_points - COALESCE(v_trans_record.points_earned, 0)),
            debt = CASE WHEN v_trans_record.payment_method = 'debt' THEN GREATEST(0, debt - v_trans_record.total) ELSE debt END
        WHERE id = v_trans_record.customer_id AND store_id = p_store_id;
        DELETE FROM loyalty_history WHERE transaction_id = p_transaction_id AND store_id = p_store_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);
END;
$$;

-- RPC: process_refund
CREATE OR REPLACE FUNCTION public.process_refund(
    p_store_id UUID,
    p_transaction_id TEXT,
    p_reason TEXT,
    p_refund_by TEXT
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_item RECORD;
    v_trans_record RECORD;
BEGIN
    SELECT * INTO v_trans_record FROM public.transactions WHERE id = p_transaction_id AND store_id = p_store_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Transaction not found'); END IF;
    IF v_trans_record.status = 'refunded' THEN RETURN jsonb_build_object('success', false, 'error', 'Already refunded'); END IF;

    UPDATE public.transactions SET status = 'refunded', refund_reason = p_reason, refunded_at = NOW(), refund_by = p_refund_by WHERE id = p_transaction_id;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(v_trans_record.items) AS x(id TEXT, qty NUMERIC, price NUMERIC)
    LOOP
        IF v_item.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            UPDATE public.products SET stock = stock + v_item.qty, sold = sold - v_item.qty, revenue = revenue - (v_item.qty * v_item.price)
            WHERE id = v_item.id::UUID AND store_id = p_store_id;
            INSERT INTO public.stock_movements (store_id, product_id, type, qty, date, note, ref_id)
            VALUES (p_store_id, v_item.id::UUID, 'in', v_item.qty, NOW(), 'Refund #' || right(p_transaction_id, 6), p_transaction_id);
        END IF;
    END LOOP;

    IF v_trans_record.customer_id IS NOT NULL THEN
        UPDATE public.customers SET total_spent = GREATEST(0, total_spent - v_trans_record.total), loyalty_points = GREATEST(0, loyalty_points - COALESCE(v_trans_record.points_earned, 0))
        WHERE id = v_trans_record.customer_id AND store_id = p_store_id;
        INSERT INTO loyalty_history (store_id, customer_id, points, description, transaction_id, date)
        VALUES (p_store_id, v_trans_record.customer_id, -COALESCE(v_trans_record.points_earned, 0), 'Refund #' || p_transaction_id, p_transaction_id, NOW());
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);
END;
$$;

-- RPC: get_shift_summary
CREATE OR REPLACE FUNCTION public.get_shift_summary(
    p_store_id UUID,
    p_shift_id UUID
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'transactions', COALESCE(COUNT(*), 0),
        'totalSales', COALESCE(SUM(total), 0),
        'totalCashSales', COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total WHEN payment_method = 'split' AND payment_details->>'method1' = 'cash' THEN (payment_details->>'amount1')::NUMERIC WHEN payment_method = 'split' AND payment_details->>'method2' = 'cash' THEN (payment_details->>'amount2')::NUMERIC ELSE 0 END), 0),
        'totalNonCashSales', COALESCE(SUM(CASE WHEN payment_method != 'cash' AND payment_method != 'split' THEN total WHEN payment_method = 'split' THEN (CASE WHEN payment_details->>'method1' != 'cash' THEN (payment_details->>'amount1')::NUMERIC ELSE 0 END) + (CASE WHEN payment_details->>'method2' != 'cash' THEN (payment_details->>'amount2')::NUMERIC ELSE 0 END) ELSE 0 END), 0),
        'totalDiscount', COALESCE(SUM(discount), 0)
    ) INTO v_summary
    FROM transactions WHERE store_id = p_store_id AND shift_id = p_shift_id AND status = 'completed';
    RETURN v_summary;
END;
$$;

-- RPC: get_profit_loss_report (Advanced P&L)
CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_total_sales NUMERIC := 0; v_total_cogs NUMERIC := 0; v_total_discount NUMERIC := 0; v_total_tax NUMERIC := 0;
    v_total_transactions INTEGER := 0; v_total_items NUMERIC := 0; v_total_expenses NUMERIC := 0;
    v_other_income NUMERIC := 0; v_total_assets NUMERIC := 0; v_net_profit NUMERIC := 0;
BEGIN
    SELECT COALESCE(SUM(total), 0), COALESCE(SUM(discount), 0), COALESCE(SUM(tax), 0), COUNT(*)
    INTO v_total_sales, v_total_discount, v_total_tax, v_total_transactions
    FROM transactions WHERE store_id = p_store_id AND date >= p_start_date AND date <= p_end_date AND status = 'completed';

    WITH expanded_items AS (
        SELECT COALESCE((item->>'qty')::NUMERIC, 0) as q, COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c
        FROM transactions t, jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status = 'completed'
    )
    SELECT COALESCE(SUM(q), 0), COALESCE(SUM(q * c), 0) INTO v_total_items, v_total_cogs FROM expanded_items;

    SELECT COALESCE(SUM(amount::numeric), 0) INTO v_total_expenses FROM (
        SELECT date, amount, store_id, type, expense_group FROM cash_flow UNION ALL SELECT date, amount, store_id, type, expense_group FROM shift_movements
    ) cf WHERE cf.store_id = p_store_id AND cf.date >= p_start_date::DATE AND cf.date <= p_end_date::DATE AND cf.type IN ('out', 'expense') AND COALESCE(cf.expense_group, 'operational') IN ('OPEX', 'operational', 'write_off');

    SELECT COALESCE(SUM(amount), 0) INTO v_other_income FROM cash_flow WHERE store_id = p_store_id AND date >= p_start_date::DATE AND date <= p_end_date::DATE AND type = 'income';
    SELECT COALESCE(SUM(amount), 0) INTO v_total_assets FROM cash_flow WHERE store_id = p_store_id AND date >= p_start_date::DATE AND date <= p_end_date::DATE AND expense_group = 'asset';

    v_net_profit := v_total_sales - v_total_cogs - v_total_expenses + v_other_income;

    RETURN jsonb_build_object('total_sales', v_total_sales, 'total_cogs', v_total_cogs, 'total_expenses', v_total_expenses, 'other_income', v_other_income, 'net_profit', v_net_profit, 'total_transactions', v_total_transactions, 'total_items', v_total_items, 'total_tax', v_total_tax, 'total_discount', v_total_discount, 'total_assets', v_total_assets);
END;
$$;

-- RPC: get_product_sales_report
CREATE OR REPLACE FUNCTION public.get_product_sales_report(
    p_store_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
) RETURNS TABLE (product_id TEXT, product_name TEXT, category_name TEXT, total_qty NUMERIC, total_revenue NUMERIC, total_cogs NUMERIC, total_profit NUMERIC, transaction_count BIGINT) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    WITH sale_items AS (
        SELECT t.id as trans_id, (item->>'id') as p_id, (item->>'name') as p_name, COALESCE((item->>'qty')::NUMERIC, 0) as q, COALESCE((item->>'price')::NUMERIC, 0) as p, COALESCE((item->>'buyPrice')::NUMERIC, (item->>'buy_price')::NUMERIC, 0) as c
        FROM transactions t, jsonb_array_elements(t.items) as item
        WHERE t.store_id = p_store_id AND t.date >= p_start_date AND t.date <= p_end_date AND t.status = 'completed'
    )
    SELECT s.p_id as product_id, s.p_name as product_name, COALESCE(cat.name, 'Tanpa Kategori') as category_name, SUM(s.q) as t_qty, SUM(s.q * s.p) as t_revenue, SUM(s.q * s.c) as t_cogs, SUM(s.q * (s.p - s.c)) as t_profit, COUNT(DISTINCT s.trans_id) as transaction_count
    FROM sale_items s LEFT JOIN products pr ON s.p_id = pr.id::TEXT LEFT JOIN categories cat ON pr.category_id = cat.id
    GROUP BY s.p_id, s.p_name, cat.name;
END;
$$;

-- RPC: Inventory Management (Unified)
CREATE OR REPLACE FUNCTION public.add_stock_batch(p_store_id UUID, p_product_id UUID, p_qty NUMERIC, p_buy_price NUMERIC, p_sell_price NUMERIC, p_note TEXT DEFAULT '', p_expired_date DATE DEFAULT NULL) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_batch_id UUID;
BEGIN
    UPDATE products SET stock = stock + p_qty, buy_price = p_buy_price, sell_price = CASE WHEN p_sell_price > 0 THEN p_sell_price ELSE sell_price END, updated_at = NOW() WHERE id = p_product_id AND store_id = p_store_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Product not found'); END IF;
    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note) VALUES (p_store_id, p_product_id, 'in', p_qty, NOW(), COALESCE(p_note, 'Manual Addition'));
    INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date) VALUES (p_store_id, p_product_id, p_qty, p_qty, p_buy_price, NOW(), COALESCE(p_note, 'Manual Addition'), p_expired_date) RETURNING id INTO v_batch_id;
    RETURN jsonb_build_object('success', true, 'batch_id', v_batch_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_stock(p_store_id UUID, p_product_id UUID, p_qty_change NUMERIC, p_type TEXT, p_note TEXT DEFAULT 'Manual Adjustment') RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE products SET stock = stock + p_qty_change, updated_at = NOW() WHERE id = p_product_id AND store_id = p_store_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Product not found'); END IF;
    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note) VALUES (p_store_id, p_product_id, p_type, p_qty_change, NOW(), p_note);
    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reduce_stock_fifo(p_store_id UUID, p_product_id UUID, p_qty NUMERIC, p_note TEXT DEFAULT 'Pengurangan Stok (FIFO)') RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_remaining_qty NUMERIC := p_qty; v_batch RECORD; v_total_cogs NUMERIC := 0; v_deduct_qty NUMERIC;
BEGIN
    FOR v_batch IN SELECT id, current_qty, buy_price FROM batches WHERE product_id = p_product_id AND store_id = p_store_id AND current_qty > 0 ORDER BY date ASC, created_at ASC
    LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;
        v_deduct_qty := LEAST(v_batch.current_qty, v_remaining_qty);
        UPDATE batches SET current_qty = current_qty - v_deduct_qty WHERE id = v_batch.id;
        v_total_cogs := v_total_cogs + (v_deduct_qty * v_batch.buy_price);
        v_remaining_qty := v_remaining_qty - v_deduct_qty;
    END LOOP;
    UPDATE products SET stock = stock - p_qty, updated_at = NOW() WHERE id = p_product_id AND store_id = p_store_id;
    INSERT INTO stock_movements (store_id, product_id, type, qty, date, note) VALUES (p_store_id, p_product_id, 'out', -p_qty, NOW(), p_note);
    RETURN jsonb_build_object('success', true, 'cogs', v_total_cogs, 'remaining_needed', v_remaining_qty);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stock_history(p_store_id UUID, p_product_id UUID DEFAULT NULL, p_limit INT DEFAULT 500) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result JSONB;
BEGIN
    SELECT jsonb_agg(row_to_json(sm)::jsonb) INTO v_result FROM (SELECT * FROM stock_movements WHERE store_id = p_store_id AND (p_product_id IS NULL OR product_id = p_product_id) ORDER BY date DESC LIMIT p_limit) sm;
    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_store_id UUID, p_po_id UUID, p_items JSONB, p_po_updates JSONB) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item RECORD;
BEGIN
    UPDATE purchase_orders SET status = 'received', items = p_po_updates->'items', total_amount = (p_po_updates->>'totalAmount')::NUMERIC, updated_at = NOW() WHERE id = p_po_id AND store_id = p_store_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'PO not found'); END IF;
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x("productId" UUID, qty NUMERIC, "buyPrice" NUMERIC, "expiredDate" DATE)
    LOOP
        UPDATE products SET stock = stock + v_item.qty, buy_price = CASE WHEN v_item."buyPrice" > 0 THEN v_item."buyPrice" ELSE buy_price END, updated_at = NOW() WHERE id = v_item."productId" AND store_id = p_store_id;
        INSERT INTO stock_movements (store_id, product_id, type, qty, date, note, ref_id) VALUES (p_store_id, v_item."productId", 'in', v_item.qty, NOW(), 'Received from PO #' || right(p_po_id::text, 8), p_po_id::text);
        INSERT INTO batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date) VALUES (p_store_id, v_item."productId", v_item.qty, v_item.qty, v_item."buyPrice", NOW(), 'PO Reception #' || right(p_po_id::text, 8), v_item."expiredDate");
    END LOOP;
    RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: Loyalty Management
CREATE OR REPLACE FUNCTION public.redeem_stamp_card(p_stamp_id uuid, p_customer_id TEXT, p_target_stamps int, p_reward_points int) RETURNS boolean 
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

CREATE OR REPLACE FUNCTION public.reset_loyalty_points(p_store_id UUID) RETURNS VOID 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.customers SET loyalty_points = 0 WHERE store_id = p_store_id; END;
$$;

-- RPC: Emergency Utilities
CREATE OR REPLACE FUNCTION public.reset_store_data(p_store_id UUID) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    DELETE FROM public.transactions WHERE store_id = p_store_id;
    DELETE FROM public.stock_movements WHERE store_id = p_store_id;
    DELETE FROM public.batches WHERE store_id = p_store_id;
    DELETE FROM public.purchase_orders WHERE store_id = p_store_id;
    DELETE FROM public.loyalty_history WHERE store_id = p_store_id;
    DELETE FROM public.shift_movements WHERE store_id = p_store_id;
    DELETE FROM public.shifts WHERE store_id = p_store_id;
    UPDATE public.products SET stock = 0, sold = 0, revenue = 0 WHERE store_id = p_store_id;
    RETURN jsonb_build_object('success', true);
END;
$$;

-- =========================================================
-- 3. PERMISSIONS & REFRESH
-- =========================================================

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
SELECT 'DATABASE STABILIZED SUCCESSFULLY' as status;
