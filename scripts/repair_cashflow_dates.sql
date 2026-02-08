-- Helper Function to parse Indonesian Date from Description
-- Format expected: "Rekap Penjualan DD Mon YYYY..."
-- Example: "Rekap Penjualan 30 Jan 2026 (38 Transaksi)"

DO $$ 
DECLARE
    r RECORD;
    v_date_str TEXT;
    v_day INT;
    v_month_str TEXT;
    v_year INT;
    v_month_num INT;
    v_new_date DATE;
    v_updated_count INT := 0;
BEGIN
    FOR r IN SELECT * FROM cash_flow WHERE category = 'Penjualan (Rekap)' LOOP
        -- Extract Date Part using Regex (DD Mon YYYY)
        -- Matches "30 Jan 2026" from "Rekap Penjualan 30 Jan 2026..."
        v_date_str := substring(r.description from 'Rekap Penjualan (\d{2} \w{3} \d{4})');
        
        IF v_date_str IS NOT NULL THEN
            -- Split manually because to_date with Indonesian locale might vary on server
            v_day := split_part(v_date_str, ' ', 1)::INT;
            v_month_str := split_part(v_date_str, ' ', 2);
            v_year := split_part(v_date_str, ' ', 3)::INT;

            -- Map Indonesian Month to Number
            CASE v_month_str
                WHEN 'Jan' THEN v_month_num := 1;
                WHEN 'Feb' THEN v_month_num := 2;
                WHEN 'Mar' THEN v_month_num := 3;
                WHEN 'Apr' THEN v_month_num := 4;
                WHEN 'Mei' THEN v_month_num := 5;
                WHEN 'Jun' THEN v_month_num := 6;
                WHEN 'Jul' THEN v_month_num := 7;
                WHEN 'Agu' THEN v_month_num := 8;
                WHEN 'Sep' THEN v_month_num := 9;
                WHEN 'Okt' THEN v_month_num := 10;
                WHEN 'Nov' THEN v_month_num := 11;
                WHEN 'Des' THEN v_month_num := 12;
                ELSE v_month_num := NULL;
            END CASE;

            IF v_month_num IS NOT NULL THEN
                v_new_date := make_date(v_year, v_month_num, v_day);
                
                -- Update if date is different (to save specific rows)
                IF r.date != v_new_date THEN
                    UPDATE cash_flow 
                    SET date = v_new_date
                    WHERE id = r.id;
                    v_updated_count := v_updated_count + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RAISE NOTICE 'Repaired % rows.', v_updated_count;
END $$;
