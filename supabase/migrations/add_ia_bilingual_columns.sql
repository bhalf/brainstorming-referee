-- Bilingual support: store both DE and EN versions of generated text
ALTER TABLE ia_canonical_questions ADD COLUMN IF NOT EXISTS canonical_text_alt text;
ALTER TABLE ia_question_summaries ADD COLUMN IF NOT EXISTS summary_text_alt text;
