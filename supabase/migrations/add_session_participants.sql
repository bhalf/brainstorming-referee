-- ============================================
-- Migration: Add participant tracking
-- ============================================
-- Run this in Supabase SQL Editor to add
-- session participant tracking.
-- ============================================

-- Add last_heartbeat column to sessions (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'last_heartbeat'
  ) THEN
    ALTER TABLE sessions ADD COLUMN last_heartbeat timestamptz DEFAULT now();
  END IF;
END $$;

-- Create session_participants table
CREATE TABLE IF NOT EXISTS session_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  identity text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'participant',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE(session_id, identity)
);

CREATE INDEX IF NOT EXISTS idx_participants_active
  ON session_participants(session_id) WHERE left_at IS NULL;

-- Enable Realtime for session_participants (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;
