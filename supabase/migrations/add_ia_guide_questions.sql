-- Guide questions (Leitfaden) for interview analysis projects

CREATE TABLE IF NOT EXISTS ia_guide_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ia_projects(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  topic_area text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Store the raw pasted text for reference/re-parsing
ALTER TABLE ia_projects ADD COLUMN IF NOT EXISTS guide_raw_text text;

-- Track which canonical questions originated from guide questions
ALTER TABLE ia_canonical_questions ADD COLUMN IF NOT EXISTS guide_question_id uuid REFERENCES ia_guide_questions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ia_guide_project ON ia_guide_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_ia_canonical_guide ON ia_canonical_questions(guide_question_id);
