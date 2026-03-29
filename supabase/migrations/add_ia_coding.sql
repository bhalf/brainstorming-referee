-- Coding System: Codebook + Code Assignments
-- Enables qualitative text coding on interview answers

-- ia_codes: Hierarchical codebook (parent_id = null → top-level category)
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

-- ia_code_assignments: Links codes to text selections in answers
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

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ia_codes_project ON ia_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_ia_codes_parent ON ia_codes(parent_id);
CREATE INDEX IF NOT EXISTS idx_ia_code_assignments_code ON ia_code_assignments(code_id);
CREATE INDEX IF NOT EXISTS idx_ia_code_assignments_answer ON ia_code_assignments(answer_id);
