-- Migration: Create error_reports table for in-app bug reporting
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS error_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  page_url TEXT,
  description TEXT,
  error_message TEXT,
  error_stack TEXT,
  browser_info JSONB DEFAULT '{}'::jsonb,
  app_version TEXT,
  status TEXT DEFAULT 'open',  -- open, in_progress, resolved, closed
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by status and date
CREATE INDEX IF NOT EXISTS idx_error_reports_status ON error_reports(status);
CREATE INDEX IF NOT EXISTS idx_error_reports_created ON error_reports(created_at DESC);

-- RLS
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can INSERT their own reports
CREATE POLICY "Authenticated users can insert error reports"
  ON error_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can read their own reports
CREATE POLICY "Users can read own error reports"
  ON error_reports FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Super admin can read ALL reports
CREATE POLICY "Service role can read all error reports"
  ON error_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
