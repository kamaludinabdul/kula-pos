DO $$
DECLARE
    missing_columns TEXT[] := ARRAY[]::TEXT[];
    col TEXT;
    expected_columns TEXT[] := ARRAY[
        'name', 'description', 'type', 'discount_value', 'target_ids', 
        'start_date', 'end_date', 'is_active', 'min_purchase', 
        'usage_limit', 'allow_multiples', 'store_id'
    ];
BEGIN
    FOR col IN SELECT unnest(expected_columns) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'promotions' 
            AND column_name = col
        ) THEN
            missing_columns := array_append(missing_columns, col);
        END IF;
    END LOOP;

    IF array_length(missing_columns, 1) > 0 THEN
        RAISE EXCEPTION 'Missing columns in promotions table: %', missing_columns;
    ELSE
        RAISE NOTICE 'All expected columns dependend on by PromotionForm.jsx exist in promotions table.';
    END IF;
END $$;
