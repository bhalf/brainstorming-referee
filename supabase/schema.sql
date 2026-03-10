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
  last_heartbeat timestamptz default now(),
  report jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_room on sessions(room_name);
create index if not exists idx_sessions_active on sessions(room_name) where ended_at is null;

-- Session Participants (tracks who is in each room)
create table if not exists session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  identity text not null,
  display_name text not null,
  role text not null default 'participant',
  joined_at timestamptz not null default now(),
  last_heartbeat timestamptz not null default now(),
  left_at timestamptz,
  unique(session_id, identity)
);
create index if not exists idx_participants_active on session_participants(session_id) where left_at is null;

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
  recovery_result text,
  recovery_checked_at bigint,
  rule_violated text,
  rule_evidence text,
  rule_severity text,
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

-- Ideas (live idea board sticky notes)
create table if not exists ideas (
  id text primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  title text not null,
  description text,
  author text not null,
  source text not null default 'manual',
  source_segment_ids text[] default '{}',
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  color text not null default 'yellow',
  is_deleted boolean not null default false,
  idea_type text not null default 'idea',
  parent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ideas_session on ideas(session_id, created_at);

-- Idea Connections (edges between related ideas on the idea board)
create table if not exists idea_connections (
  id text primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  source_idea_id text not null,
  target_idea_id text not null,
  label text,
  connection_type text not null default 'related',
  created_at timestamptz not null default now()
);
create index if not exists idx_idea_connections_session on idea_connections(session_id);

-- Intervention Annotations (manual evaluation by researchers)
create table if not exists intervention_annotations (
  id uuid primary key default gen_random_uuid(),
  intervention_id text not null references interventions(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  rating int check (rating between 1 and 5),
  relevance text check (relevance in ('relevant', 'partially_relevant', 'not_relevant')),
  effectiveness text check (effectiveness in ('effective', 'partially_effective', 'not_effective')),
  notes text,
  annotator text not null default 'anonymous',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_annotations_unique on intervention_annotations(intervention_id, annotator);
create index if not exists idx_annotations_session on intervention_annotations(session_id);

-- Session Errors (runtime errors captured during sessions)
create table if not exists session_errors (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  timestamp bigint not null,
  message text not null,
  context text,
  created_at timestamptz not null default now()
);
create index if not exists idx_session_errors_session on session_errors(session_id, timestamp);

-- Session Events (lifecycle / configuration events)
create table if not exists session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  actor text,
  timestamp bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_session_events_session on session_events(session_id, timestamp);

-- Enable Realtime (run these in Supabase SQL Editor after creating tables)
-- alter publication supabase_realtime add table transcript_segments;
-- alter publication supabase_realtime add table interventions;
-- alter publication supabase_realtime add table engine_state;
-- alter publication supabase_realtime add table metric_snapshots;
-- alter publication supabase_realtime add table sessions;
-- alter publication supabase_realtime add table ideas;
-- IMPORTANT: The ideas table MUST be added to the Realtime publication
-- for multi-participant sync to work. Run this command in Supabase SQL Editor:
--   alter publication supabase_realtime add table ideas;
--   alter publication supabase_realtime add table idea_connections;
