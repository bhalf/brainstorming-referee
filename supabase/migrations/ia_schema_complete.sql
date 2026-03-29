-- ============================================================================
-- Interview-Analyse: Komplettes Schema (idempotent — kann beliebig oft ausgeführt werden)
-- ============================================================================

-- ─── 1. Core Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ia_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  language text NOT NULL DEFAULT 'de',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ia_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ia_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}',
  transcript_text text,
  transcript_segments jsonb,
  status text NOT NULL DEFAULT 'pending',
  source_type text NOT NULL DEFAULT 'audio',
  word_count int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ia_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES ia_interviews(id) ON DELETE CASCADE,
  original_text text NOT NULL,
  normalized_text text NOT NULL,
  topic text,
  segment_start_index int,
  segment_end_index int,
  is_followup boolean DEFAULT false,
  parent_question_id uuid REFERENCES ia_questions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ia_canonical_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ia_projects(id) ON DELETE CASCADE,
  canonical_text text NOT NULL,
  topic_area text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ia_question_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_question_id uuid NOT NULL REFERENCES ia_canonical_questions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES ia_questions(id) ON DELETE CASCADE,
  similarity float,
  UNIQUE(question_id)
);

CREATE TABLE IF NOT EXISTS ia_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES ia_interviews(id) ON DELETE CASCADE,
  canonical_question_id uuid NOT NULL REFERENCES ia_canonical_questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  word_count int,
  sentiment text,
  follow_ups jsonb DEFAULT '[]',
  segment_start float,
  segment_end float,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ia_question_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_question_id uuid NOT NULL REFERENCES ia_canonical_questions(id) ON DELETE CASCADE,
  summary_text text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(canonical_question_id)
);

-- ─── 2. Guide Questions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ia_guide_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ia_projects(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  topic_area text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Guide raw text on projects
ALTER TABLE ia_projects ADD COLUMN IF NOT EXISTS guide_raw_text text;

-- Link canonical questions to guide questions
ALTER TABLE ia_canonical_questions ADD COLUMN IF NOT EXISTS guide_question_id uuid REFERENCES ia_guide_questions(id) ON DELETE SET NULL;

-- ─── 3. Answer Quality Metadata ─────────────────────────────────────────────

ALTER TABLE ia_answers ADD COLUMN IF NOT EXISTS confidence text;
ALTER TABLE ia_answers ADD COLUMN IF NOT EXISTS match_type text;
ALTER TABLE ia_answers ADD COLUMN IF NOT EXISTS original_question_text text;

-- ─── 4. Interview Groups ────────────────────────────────────────────────────

ALTER TABLE ia_interviews ADD COLUMN IF NOT EXISTS group_label text;

-- ─── 5. Bilingual Support ───────────────────────────────────────────────────

ALTER TABLE ia_canonical_questions ADD COLUMN IF NOT EXISTS canonical_text_alt text;
ALTER TABLE ia_question_summaries ADD COLUMN IF NOT EXISTS summary_text_alt text;

-- ─── 6. Comparison Cache ────────────────────────────────────────────────────

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

-- ─── 7. Coding System ──────────────────────────────────────────────────────

-- Hierarchical codebook (parent_id = null → top-level category)
CREATE TABLE IF NOT EXISTS ia_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES ia_projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES ia_codes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#6366F1',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Links codes to text selections in answers
CREATE TABLE IF NOT EXISTS ia_code_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES ia_codes(id) ON DELETE CASCADE,
  answer_id uuid NOT NULL REFERENCES ia_answers(id) ON DELETE CASCADE,
  start_offset int NOT NULL,
  end_offset int NOT NULL,
  selected_text text NOT NULL,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 8. All Indexes ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ia_interviews_project ON ia_interviews(project_id);
CREATE INDEX IF NOT EXISTS idx_ia_interviews_group ON ia_interviews(group_label);
CREATE INDEX IF NOT EXISTS idx_ia_questions_interview ON ia_questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_ia_canonical_project ON ia_canonical_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_ia_canonical_guide ON ia_canonical_questions(guide_question_id);
CREATE INDEX IF NOT EXISTS idx_ia_mappings_canonical ON ia_question_mappings(canonical_question_id);
CREATE INDEX IF NOT EXISTS idx_ia_answers_interview ON ia_answers(interview_id);
CREATE INDEX IF NOT EXISTS idx_ia_answers_canonical ON ia_answers(canonical_question_id);
CREATE INDEX IF NOT EXISTS idx_ia_guide_project ON ia_guide_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_ia_comparison_project ON ia_comparison_summaries(project_id);
CREATE INDEX IF NOT EXISTS idx_ia_codes_project ON ia_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_ia_codes_parent ON ia_codes(parent_id);
CREATE INDEX IF NOT EXISTS idx_ia_code_assignments_code ON ia_code_assignments(code_id);
CREATE INDEX IF NOT EXISTS idx_ia_code_assignments_answer ON ia_code_assignments(answer_id);
