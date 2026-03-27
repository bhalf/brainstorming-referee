-- Interview-Analyse Tables (ia_ prefix)
-- Run this in Supabase Dashboard → SQL Editor

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ia_interviews_project ON ia_interviews(project_id);
CREATE INDEX IF NOT EXISTS idx_ia_questions_interview ON ia_questions(interview_id);
CREATE INDEX IF NOT EXISTS idx_ia_canonical_project ON ia_canonical_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_ia_mappings_canonical ON ia_question_mappings(canonical_question_id);
CREATE INDEX IF NOT EXISTS idx_ia_answers_interview ON ia_answers(interview_id);
CREATE INDEX IF NOT EXISTS idx_ia_answers_canonical ON ia_answers(canonical_question_id);
