-- Run this in Supabase SQL Editor
ALTER TABLE rental_sessions ADD COLUMN IF NOT EXISTS overtime_start_time timestamptz;
