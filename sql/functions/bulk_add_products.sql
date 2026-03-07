-- MASTER: bulk_add_products
-- Purpose: Optimized bulk product import with initial batch creation

CREATE OR REPLACE FUNCTION public.bulk_add_products(
    p_store_id UUID,
    p_products JSONB
) RETURNS JSONB 
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_product RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_product IN SELECT * FROM jsonb_to_recordset(p_products) AS x(
        name TEXT, 
        sku TEXT, 
        barcode TEXT, 
        category_id UUID, 
        buy_price NUMERIC, 
        sell_price NUMERIC, 
        stock NUMERIC, 
        unit TEXT, 
        description TEXT,
        is_unlimited BOOLEAN,
        min_stock NUMERIC,
        expired_date DATE
    )
    LOOP
        INSERT INTO public.products (
            store_id, name, sku, barcode, category_id, buy_price, sell_price, 
            stock, unit, description, is_unlimited, min_stock
        )
        VALUES (
            p_store_id, v_product.name, v_product.sku, v_product.barcode, v_product.category_id, 
            v_product.buy_price, v_product.sell_price, v_product.stock, v_product.unit, 
            v_product.description, COALESCE(v_product.is_unlimited, false), COALESCE(v_product.min_stock, 0)
        )
        ON CONFLICT (store_id, sku) DO NOTHING;

        -- Create initial batch if stock > 0
        IF v_product.stock > 0 THEN
            INSERT INTO public.batches (store_id, product_id, initial_qty, current_qty, buy_price, date, note, expired_date)
            SELECT p_store_id, id, v_product.stock, v_product.stock, v_product.buy_price, NOW(), 'Initial Stock (Bulk Add)', v_product.expired_date
            FROM public.products 
            WHERE sku = v_product.sku AND store_id = p_store_id;
        END IF;

        v_count := v_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;
