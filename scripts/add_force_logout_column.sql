-- Add last_force_logout_at column to profiles table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_force_logout_at') THEN
        ALTER TABLE public.profiles ADD COLUMN last_force_logout_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
