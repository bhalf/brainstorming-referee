import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export const maxDuration = 30;

/**
 * GET: Generate a scientific interview analysis report from existing DB data.
 * No AI generation — all data comes directly from the pipeline results.
 * Quotes are verbatim from transcripts (via ia_answers.answer_text).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const sb = getServiceClient();

  // Load project
  const { data: project } = await sb
    .from('ia_projects')
    .select('name, description, language')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Load interviews
  const { data: interviews } = await sb
    .from('ia_interviews')
    .select('id, name, status, group_label, word_count')
    .eq('project_id', projectId)
    .in('status', ['transcribed', 'analyzed'])
    .order('name');

  // Load canonical questions (sorted)
  const { data: canonicals } = await sb
    .from('ia_canonical_questions')
    .select('id, canonical_text, canonical_text_alt, topic_area, sort_order, guide_question_id')
    .eq('project_id', projectId)
    .order('sort_order');

  if (!canonicals?.length || !interviews?.length) {
    return NextResponse.json({ error: 'No analysis data available' }, { status: 400 });
  }

  const canonicalIds = canonicals.map(c => c.id);

  // Load all answers with interview names
  const { data: answers } = await sb
    .from('ia_answers')
    .select('*, ia_interviews(name, group_label)')
    .in('canonical_question_id', canonicalIds);

  // Load summaries
  const { data: summaries } = await sb
    .from('ia_question_summaries')
    .select('*')
    .in('canonical_question_id', canonicalIds);

  // Build report
  const interviewMap = new Map(interviews.map(i => [i.id, i]));
  const summaryMap = new Map((summaries ?? []).map(s => [s.canonical_question_id, s]));

  const guideQuestionIds = new Set(canonicals.filter(c => c.guide_question_id).map(c => c.id));
  const guideQuestions = canonicals.filter(c => c.guide_question_id);
  const additionalQuestions = canonicals.filter(c => !c.guide_question_id);

  const questions = canonicals.map((cq, idx) => {
    const cqAnswers = (answers ?? [])
      .filter(a => a.canonical_question_id === cq.id)
      .map((a: {
        id: string;
        interview_id: string;
        answer_text: string;
        sentiment: string | null;
        confidence: string | null;
        match_type: string | null;
        word_count: number | null;
        follow_ups: Array<{ question: string; answer: string }>;
        ia_interviews: { name: string; group_label: string | null };
      }) => ({
        interview_id: a.interview_id,
        interview_name: a.ia_interviews?.name ?? 'Unknown',
        group_label: a.ia_interviews?.group_label ?? null,
        answer_text: a.answer_text,
        sentiment: a.sentiment,
        confidence: a.confidence,
        match_type: a.match_type,
        word_count: a.word_count,
        follow_ups: a.follow_ups ?? [],
      }));

    // Sentiment distribution
    const sentimentDist: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
    for (const a of cqAnswers) {
      sentimentDist[a.sentiment || 'neutral']++;
    }

    // Select strongest quotes (longest answers with clear sentiment, max 5)
    const quoteCandidates = [...cqAnswers]
      .filter(a => a.answer_text.trim().length > 30)
      .sort((a, b) => (b.word_count ?? 0) - (a.word_count ?? 0));

    // Pick diverse quotes: try to get different sentiments and interviews
    const selectedQuotes: typeof quoteCandidates = [];
    const usedInterviews = new Set<string>();
    const usedSentiments = new Set<string>();

    // First pass: diverse sentiments
    for (const q of quoteCandidates) {
      if (selectedQuotes.length >= 5) break;
      if (!usedSentiments.has(q.sentiment || 'neutral') || !usedInterviews.has(q.interview_id)) {
        selectedQuotes.push(q);
        usedInterviews.add(q.interview_id);
        usedSentiments.add(q.sentiment || 'neutral');
      }
    }

    // Fill up to 5 if needed
    for (const q of quoteCandidates) {
      if (selectedQuotes.length >= 5) break;
      if (!selectedQuotes.includes(q)) {
        selectedQuotes.push(q);
      }
    }

    const summary = summaryMap.get(cq.id);

    return {
      canonical_question_id: cq.id,
      number: idx + 1,
      canonical_text: cq.canonical_text,
      canonical_text_alt: cq.canonical_text_alt,
      topic_area: cq.topic_area,
      is_guide_question: !!cq.guide_question_id,
      total_answers: cqAnswers.length,
      total_interviews: interviews.length,
      coverage_pct: Math.round((cqAnswers.length / interviews.length) * 100),
      sentiment_distribution: sentimentDist,
      summary_text: summary?.summary_text ?? null,
      summary_text_alt: summary?.summary_text_alt ?? null,
      quotes: selectedQuotes.map(q => ({
        interview_name: q.interview_name,
        group_label: q.group_label,
        text: q.answer_text,
        sentiment: q.sentiment,
        word_count: q.word_count,
      })),
      // All answers for completeness
      all_answers: cqAnswers.map(a => ({
        interview_name: a.interview_name,
        group_label: a.group_label,
        text: a.answer_text,
        sentiment: a.sentiment,
        confidence: a.confidence,
        match_type: a.match_type,
      })),
    };
  });

  // Metadata
  const interviewsNotFullyCovered = questions.filter(q => q.coverage_pct < 100);
  const additionalTopics = additionalQuestions.map(q => ({
    text: q.canonical_text,
    topic: q.topic_area,
  }));

  return NextResponse.json({
    project: {
      name: project.name,
      description: project.description,
      language: project.language,
    },
    meta: {
      total_interviews: interviews.length,
      interview_names: interviews.map(i => i.name),
      total_guide_questions: guideQuestions.length,
      total_additional_questions: additionalQuestions.length,
      total_canonical_questions: canonicals.length,
      all_questions_asked: interviewsNotFullyCovered.length === 0,
      questions_with_gaps: interviewsNotFullyCovered.map(q => ({
        question: q.canonical_text,
        coverage: `${q.total_answers}/${q.total_interviews}`,
      })),
      additional_topics: additionalTopics,
    },
    questions,
  });
}
