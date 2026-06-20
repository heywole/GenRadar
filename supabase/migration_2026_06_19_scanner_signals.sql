-- ================================================================
-- GenRadar — add real scanner signal storage
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- ================================================================

ALTER TABLE projects  ADD COLUMN IF NOT EXISTS last_scan_signals JSONB;
ALTER TABLE ai_scores  ADD COLUMN IF NOT EXISTS scanner_signals   JSONB;
