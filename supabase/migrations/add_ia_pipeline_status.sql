-- Pipeline status tracking on ia_projects
ALTER TABLE ia_projects ADD COLUMN IF NOT EXISTS pipeline_status jsonb DEFAULT NULL;
-- Expected shape: { "running": true, "step": "extract-questions", "progress": "3/30", "started_at": "...", "error": null }
