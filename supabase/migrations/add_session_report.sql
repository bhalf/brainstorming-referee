-- ============================================
-- Migration: Add report column to sessions
-- ============================================
-- Stores the computed post-session report as JSONB.
-- Generated at session end or on-demand via API.
-- ============================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS report jsonb;
