ALTER TABLE ia_interviews ADD COLUMN IF NOT EXISTS group_label text;
CREATE INDEX IF NOT EXISTS idx_ia_interviews_group ON ia_interviews(group_label);
