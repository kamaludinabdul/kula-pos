DO $$ 
BEGIN 
    -- Add notes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'notes') THEN
        ALTER TABLE public.suppliers ADD COLUMN notes TEXT;
    END IF;

    -- Refresh schema cache just in case
    NOTIFY pgrst, 'reload schema';
END $$;
