-- 003_portfolio_links.sql
-- Adds external links ("Ver en acción") to portfolio projects.
-- Each entry: { label: string, url: string, type: 'web'|'video'|'behance'|'instagram'|'other' }

ALTER TABLE portfolio_projects
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb;
