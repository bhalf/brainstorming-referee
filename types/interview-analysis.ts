// ─── Interview Analysis Types ─────────────────────────────────────────────────

export type InterviewStatus = 'pending' | 'transcribing' | 'transcribed' | 'analyzed';
export type SourceType = 'audio' | 'text';
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'ambivalent';

export interface IAProject {
  id: string;
  name: string;
  description: string | null;
  language: string;
  guide_raw_text: string | null;
  created_at: string;
  updated_at: string;
  interview_count?: number;
}

export interface IAInterviewMetadata {
  date?: string;
  interviewer?: string;
  duration_min?: number;
  [key: string]: unknown;
}

export interface IATranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface IAInterview {
  id: string;
  project_id: string;
  name: string;
  metadata: IAInterviewMetadata;
  transcript_text: string | null;
  transcript_segments: IATranscriptSegment[] | null;
  status: InterviewStatus;
  source_type: SourceType;
  word_count: number | null;
  created_at: string;
  updated_at: string;
}

export interface IAQuestion {
  id: string;
  interview_id: string;
  original_text: string;
  normalized_text: string;
  topic: string | null;
  segment_start_index: number | null;
  segment_end_index: number | null;
  is_followup: boolean;
  parent_question_id: string | null;
  created_at: string;
}

export interface IACanonicalQuestion {
  id: string;
  project_id: string;
  canonical_text: string;
  topic_area: string | null;
  sort_order: number;
  guide_question_id: string | null;
  created_at: string;
}

export interface IAGuideQuestion {
  id: string;
  project_id: string;
  question_text: string;
  topic_area: string | null;
  sort_order: number;
  created_at: string;
}

export interface IAQuestionMapping {
  id: string;
  canonical_question_id: string;
  question_id: string;
  similarity: number | null;
}

export type AnswerConfidence = 'high' | 'medium' | 'low';
export type AnswerMatchType = 'direct' | 'paraphrased' | 'implicit' | 'scattered';

export interface IAAnswer {
  id: string;
  interview_id: string;
  canonical_question_id: string;
  answer_text: string;
  word_count: number | null;
  sentiment: Sentiment | null;
  confidence: AnswerConfidence | null;
  match_type: AnswerMatchType | null;
  original_question_text: string | null;
  follow_ups: Array<{ question: string; answer: string }>;
  segment_start: number | null;
  segment_end: number | null;
  created_at: string;
}

export interface IAQuestionSummary {
  id: string;
  canonical_question_id: string;
  summary_text: string;
  generated_at: string;
}

// ─── API Request/Response Types ───────────────────────────────────────────────

export interface CreateProjectRequest {
  name: string;
  description?: string;
  language?: string;
}

export interface CreateInterviewRequest {
  name: string;
  metadata?: IAInterviewMetadata;
  transcript_text?: string;
  source_type: SourceType;
}

export interface UpdateInterviewRequest {
  name?: string;
  metadata?: IAInterviewMetadata;
  transcript_text?: string;
  status?: InterviewStatus;
}

// ─── Matrix View Types ────────────────────────────────────────────────────────

export interface MatrixQuestion {
  canonical: IACanonicalQuestion;
  answers: (IAAnswer & { interview_name: string })[];
  coverage: number;
  total_interviews: number;
  summary: IAQuestionSummary | null;
  mappings: (IAQuestionMapping & { ia_questions: IAQuestion })[];
}

export interface MatrixData {
  questions: MatrixQuestion[];
  interviews: IAInterview[];
}

export type MatrixFilter = {
  sentiment?: Sentiment;
  interview_id?: string;
  min_word_count?: number;
  search?: string;
};
