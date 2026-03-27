-- Add quality metadata columns to ia_answers
ALTER TABLE ia_answers ADD COLUMN IF NOT EXISTS confidence text;
ALTER TABLE ia_answers ADD COLUMN IF NOT EXISTS match_type text;
ALTER TABLE ia_answers ADD COLUMN IF NOT EXISTS original_question_text text;
