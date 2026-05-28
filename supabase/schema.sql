-- ================================================================
-- GenLayer Projects Hub — Supabase Database Schema
-- Run this ONCE in: app.supabase.com → your project → SQL Editor
-- ================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Projects ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  website_url TEXT        NOT NULL UNIQUE,
  github_url  TEXT,
  category    TEXT        NOT NULL,
  logo_url    TEXT,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'active', 'flagged', 'removed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_status   ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_created  ON projects(created_at DESC);

-- ── AI Scores ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_scores (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID        NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  score        INTEGER     NOT NULL CHECK (score >= 0 AND score <= 100),
  risk         TEXT        NOT NULL CHECK (risk IN ('Low', 'Medium', 'High')),
  confidence   TEXT        NOT NULL CHECK (confidence IN ('Low', 'Medium', 'High')),
  positives    TEXT[]      NOT NULL DEFAULT '{}',
  risks        TEXT[]      NOT NULL DEFAULT '{}',
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_scores_project ON ai_scores(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_scores_score   ON ai_scores(score DESC);

-- ── Interactions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interactions (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('view', 'save', 'report')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_interactions_project ON interactions(project_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user    ON interactions(user_id);

-- ================================================================
-- ROW LEVEL SECURITY
-- Supabase requires RLS to be enabled. These policies ensure:
--   - Anyone can read active projects and scores
--   - Only authenticated users can insert projects / interactions
--   - Users can only modify their own data
-- ================================================================

ALTER TABLE projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Projects: public read of active projects
CREATE POLICY "Public can read active projects"
  ON projects FOR SELECT
  USING (status = 'active');

-- Projects: authenticated users can insert
CREATE POLICY "Authenticated users can insert projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Projects: service role can update (for status changes by API)
CREATE POLICY "Service role can update projects"
  ON projects FOR UPDATE
  USING (true);

-- AI Scores: public read
CREATE POLICY "Public can read ai_scores"
  ON ai_scores FOR SELECT
  USING (true);

-- AI Scores: service role inserts (only backend does this)
CREATE POLICY "Service role can insert ai_scores"
  ON ai_scores FOR INSERT
  WITH CHECK (true);

-- Interactions: public read (for view/save/report counts)
CREATE POLICY "Public can read interactions"
  ON interactions FOR SELECT
  USING (true);

-- Interactions: authenticated users can insert their own
CREATE POLICY "Authenticated users can insert interactions"
  ON interactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- STORAGE BUCKET for project logos
-- Also run this in the SQL editor
-- ================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-logos', 'project-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-logos');

CREATE POLICY "Authenticated users can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-logos');

-- ================================================================
-- AFTER running this schema, do these 2 things in Supabase dashboard:
--
-- 1. Authentication → URL Configuration → set Site URL:
--    Development: http://localhost:3000
--    Production:  https://your-app.vercel.app
--
-- 2. Authentication → URL Configuration → add Redirect URLs:
--    http://localhost:3000/api/auth/callback
--    https://your-app.vercel.app/api/auth/callback
-- ================================================================

-- ── Builder Profiles ──────────────────────────────────────────
-- Run this in Supabase SQL Editor to add builder profiles support
CREATE TABLE IF NOT EXISTS builder_profiles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bio         TEXT,
  twitter_url TEXT,
  telegram_url TEXT,
  github_url  TEXT,
  discord_url TEXT,
  website_url TEXT,
  other_links TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE builder_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read builder profiles"
  ON builder_profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own builder profile"
  ON builder_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own builder profile"
  ON builder_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_builder_profiles_user ON builder_profiles(user_id);
