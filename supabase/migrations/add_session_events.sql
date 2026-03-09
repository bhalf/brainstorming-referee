-- ============================================
-- Migration: Add session_events table
-- ============================================
-- Generic event log for tracking session lifecycle
-- events like transcription provider changes, decision
-- owner switches, voice settings changes, etc.
-- ============================================

CREATE TABLE IF NOT EXISTS session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  actor text,
  timestamp bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON session_events(session_id, event_type);
