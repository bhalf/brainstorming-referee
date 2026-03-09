-- ============================================
-- Migration: Add session_errors table
-- ============================================
-- Tracks errors that occur during a session for
-- post-session debugging and analysis.
-- ============================================

CREATE TABLE IF NOT EXISTS session_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  timestamp bigint NOT NULL,
  message text NOT NULL,
  context text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_errors_session ON session_errors(session_id, timestamp);
