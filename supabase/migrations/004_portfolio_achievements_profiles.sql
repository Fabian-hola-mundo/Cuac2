-- 004_portfolio_achievements_profiles.sql
-- Achievements (awards, honorable mentions, selections) and per-owner profiles
-- (collective + each member) with bio, photo and downloadable CV.
--
-- Note: RLS is intentionally left off here to match the existing portfolio_projects
-- setup in this project (public site reads with the anon key; admin writes through
-- the dev-bypass panel). Enable RLS + policies before production.

-- ── Achievements ───────────────────────────────────────────────────────────────
create table if not exists portfolio_achievements (
  id           uuid primary key default gen_random_uuid(),
  owner        text        not null default 'cuac',   -- 'cuac' | 'natalia' | 'nathali'
  title        text        not null,
  organization text,
  year         int,
  type         text        not null default 'award',  -- 'award' | 'mention' | 'selection' | 'other'
  url          text,
  sort_order   int         not null default 0,
  published    boolean     not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists portfolio_achievements_owner_idx on portfolio_achievements (owner);

-- ── Profiles ───────────────────────────────────────────────────────────────────
create table if not exists portfolio_profiles (
  owner      text primary key,                         -- 'cuac' | 'natalia' | 'nathali'
  bio        text,
  photo_url  text,
  cv_url     text,
  updated_at timestamptz not null default now()
);

insert into portfolio_profiles (owner) values ('cuac'), ('natalia'), ('nathali')
  on conflict (owner) do nothing;
