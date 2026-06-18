-- ================================================================
-- GenRadar — security + evaluation-pipeline migration
--
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste
-- this whole file → Run. Safe to re-run (every statement is
-- idempotent — DROP/CREATE, ADD COLUMN IF NOT EXISTS, etc).
-- ================================================================

-- ── 1. New columns needed by the fixed evaluation pipeline ──────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS evaluation_error          TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS evaluation_tx_hash        TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS evaluation_started_at     TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS evaluation_last_polled_at TIMESTAMPTZ;

-- ── 2. Defensive — make sure columns the app already relies on exist.
--      No-ops if your live DB already has them (it almost certainly
--      does, since submissions already work) — this just makes
--      schema.sql stop lying about what's really in the database.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS twitter_url          TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS discord_url          TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS telegram_url         TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS docs_url             TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS evaluation_status    TEXT DEFAULT 'pending';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS evaluation_attempts  INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS community_score      INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rating_count         INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE builder_profiles ADD COLUMN IF NOT EXISTS name    TEXT;
ALTER TABLE builder_profiles ADD COLUMN IF NOT EXISTS country TEXT;

-- ── 3. Allow the 'rejected' status the admin panel already sets ──
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('pending', 'active', 'flagged', 'removed', 'rejected'));

-- ── 4. CRITICAL — close the open write hole on `projects` ───────
-- The old policy had no TO clause and USING (true), so ANY visitor with
-- the public anon key could update ANY column on ANY project directly
-- from a browser console — including overwriting status, score-related
-- fields, or another builder's listing. Replacing it with owner-only.
-- Server code using the service-role key (admin panel, evaluation
-- pipeline) bypasses RLS entirely, so none of that is affected.
DROP POLICY IF EXISTS "Service role can update projects" ON projects;

CREATE POLICY "Owners can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING      (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- There was no DELETE policy on `projects` at all, which meant the
-- "schedule deletion" feature on the profile page was silently failing
-- (RLS denies by default when no policy matches). This adds it, owner-only.
DROP POLICY IF EXISTS "Owners can delete own projects" ON projects;
CREATE POLICY "Owners can delete own projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- ── 5. CRITICAL — close the fake-score hole on `ai_scores` ───────
-- This policy's WITH CHECK (true) also had no TO clause, so anyone could
-- insert a fabricated "perfect score" for any project straight from the
-- browser console — completely undermining the trust system. Only your
-- server should ever write here, and the service-role key it uses
-- bypasses RLS regardless of any policy, so the safest fix is to remove
-- this policy entirely (RLS denies by default with no matching policy).
DROP POLICY IF EXISTS "Service role can insert ai_scores" ON ai_scores;

-- ── 6. Tables the app already queries but were missing from schema.sql ──
CREATE TABLE IF NOT EXISTS votes (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type   TEXT        NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read votes" ON votes;
CREATE POLICY "Public can read votes" ON votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own votes" ON votes;
CREATE POLICY "Users insert own votes" ON votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own votes" ON votes;
CREATE POLICY "Users update own votes" ON votes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users delete own votes" ON votes;
CREATE POLICY "Users delete own votes" ON votes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_votes_project ON votes(project_id);

CREATE TABLE IF NOT EXISTS messages (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name   TEXT,
  user_avatar TEXT,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read messages" ON messages;
CREATE POLICY "Public can read messages" ON messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own messages" ON messages;
CREATE POLICY "Users insert own messages" ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);

CREATE TABLE IF NOT EXISTS ratings (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score       INTEGER     NOT NULL CHECK (score >= 1 AND score <= 5),
  review      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read ratings" ON ratings;
CREATE POLICY "Public can read ratings" ON ratings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users insert own ratings" ON ratings;
CREATE POLICY "Users insert own ratings" ON ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own ratings" ON ratings;
CREATE POLICY "Users update own ratings" ON ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_project ON ratings(project_id);

CREATE TABLE IF NOT EXISTS custom_categories (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read custom categories" ON custom_categories;
CREATE POLICY "Public can read custom categories" ON custom_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can add categories" ON custom_categories;
CREATE POLICY "Authenticated users can add categories" ON custom_categories FOR INSERT TO authenticated WITH CHECK (true);

-- ── 7. Backfill so already-evaluated projects aren't treated as new ──
UPDATE projects p
SET evaluation_status = 'completed'
WHERE evaluation_status IS NULL
  AND EXISTS (SELECT 1 FROM ai_scores s WHERE s.project_id = p.id);

UPDATE projects
SET evaluation_status = 'pending'
WHERE evaluation_status IS NULL;
