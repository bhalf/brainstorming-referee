-- ============================================
-- UZH Brainstorming Webapp — Supabase Schema
-- ============================================
-- Run this in Supabase SQL Editor to create all tables.
-- Then enable Realtime on: transcript_segments, interventions, engine_state

-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  scenario text not null default 'A',
  language text not null default 'en-US',
  config jsonb not null default '{}',
  host_identity text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_room on sessions(room_name);
create index if not exists idx_sessions_active on sessions(room_name) where ended_at is null;

-- Transcript Segments
create table if not exists transcript_segments (
  id text primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  speaker text not null,
  text text not null,
  language text,
  timestamp bigint not null,
  is_final boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_segments_session on transcript_segments(session_id, timestamp);

-- Metric Snapshots
create table if not exists metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  timestamp bigint not null,
  metrics jsonb not null,
  state_inference jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_snapshots_session on metric_snapshots(session_id, timestamp);

-- Interventions
create table if not exists interventions (
  id text primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  type text not null,
  intent text,
  trigger text,
  message text not null,
  timestamp bigint not null,
  status text not null default 'pending',
  delivered_at bigint,
  metrics_at_intervention jsonb,
  engine_state_snapshot jsonb,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists idx_interventions_session on interventions(session_id, timestamp);

-- Engine State (singleton per session)
create table if not exists engine_state (
  session_id uuid primary key references sessions(id) on delete cascade,
  phase text not null default 'MONITORING',
  active_intent text,
  confirmation_start bigint,
  last_intervention_time bigint,
  intervention_count int not null default 0,
  decision_owner text,
  decision_heartbeat timestamptz,
  updated_at timestamptz not null default now()
);

-- Model Routing Logs
create table if not exists model_routing_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  timestamp bigint not null,
  route text not null,
  model text,
  latency_ms int,
  token_count int,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_routing_session on model_routing_logs(session_id);

-- Enable Realtime (run these after creating tables)
-- alter publication supabase_realtime add table transcript_segments;
-- alter publication supabase_realtime add table interventions;
-- alter publication supabase_realtime add table engine_state;
-- alter publication supabase_realtime add table metric_snapshots;
-- alter publication supabase_realtime add table sessions;
