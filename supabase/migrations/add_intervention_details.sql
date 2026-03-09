-- ============================================
-- Migration: Add intervention recovery & rule violation detail columns
-- ============================================
-- Adds columns to track:
--   1. Recovery result after an intervention (did it help?)
--   2. Rule violation details (which rule, evidence, severity)
-- ============================================

-- Recovery tracking
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS recovery_result TEXT;
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS recovery_checked_at BIGINT;

-- Rule violation details
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS rule_violated TEXT;
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS rule_evidence TEXT;
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS rule_severity TEXT
  CHECK (rule_severity IS NULL OR rule_severity IN ('low', 'medium', 'high'));
