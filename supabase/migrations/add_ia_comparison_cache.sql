-- Cache for AI-generated interview comparison summaries
CREATE TABLE IF NOT EXISTS ia_comparison_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ia_projects(id) ON DELETE CASCADE,
  interview_a_id uuid NOT NULL REFERENCES ia_interviews(id) ON DELETE CASCADE,
  interview_b_id uuid NOT NULL REFERENCES ia_interviews(id) ON DELETE CASCADE,
  summary_json jsonb NOT NULL,
  summary_json_alt jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_a_id, interview_b_id)
);

CREATE INDEX IF NOT EXISTS idx_ia_comparison_project ON ia_comparison_summaries(project_id);
