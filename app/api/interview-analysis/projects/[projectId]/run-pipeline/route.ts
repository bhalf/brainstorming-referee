import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const origin = req.nextUrl.origin;
  const body = await req.json().catch(() => ({}));
  const requestedMode: 'incremental' | 'full' = body.mode ?? 'incremental';

  const sb = getServiceClient();

  // ── Gather project state ────────────────────────────────────────────────────

  // 1. Find new (not yet analyzed) interviews
  const { data: allInterviews } = await sb
    .from('ia_interviews')
    .select('id, status')
    .eq('project_id', projectId);

  const newInterviewIds = (allInterviews ?? [])
    .filter(i => i.status === 'transcribed')
    .map(i => i.id);

  // 2. Check if canonicals exist
  const { count: canonicalCount } = await sb
    .from('ia_canonical_questions')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  // 3. Check if guide questions exist
  const { count: guideCount } = await sb
    .from('ia_guide_questions')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);

  const hasGuide = (guideCount ?? 0) > 0;

  // 4. Detect guide change: guide exists but no canonicals link to them
  let guideChanged = false;
  if ((canonicalCount ?? 0) > 0 && hasGuide) {
    const { count: linkedCount } = await sb
      .from('ia_canonical_questions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .not('guide_question_id', 'is', null);

    guideChanged = (linkedCount ?? 0) === 0;
  }

  // 5. Determine effective mode
  const effectiveMode: 'incremental' | 'full' =
    requestedMode === 'full' || (canonicalCount ?? 0) === 0 || guideChanged
      ? 'full'
      : 'incremental';

  // 6. Early return if nothing to do
  if (effectiveMode === 'incremental' && newInterviewIds.length === 0) {
    return NextResponse.json({
      pipeline: [],
      mode: 'incremental',
      message: 'Keine neuen Interviews zu analysieren.',
    });
  }

  // ── Build pipeline based on guide presence ──────────────────────────────────

  const results: Array<{ step: string; status: string; data?: unknown; error?: string }> = [];

  if (hasGuide) {
    // ── TRACK A: Guide-Direct Pipeline ──────────────────────────────────────
    // Skip extract-questions entirely. Create canonicals from guide, then segment.

    if (effectiveMode === 'full') {
      // Step 1: Create canonicals from guide (deterministic, no GPT)
      try {
        const res = await fetch(`${origin}/api/interview-analysis/projects/${projectId}/match-questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guideDirect: true }),
        });
        const data = await res.json();
        if (!res.ok) {
          results.push({ step: 'match-questions', status: 'error', error: data.error });
          return NextResponse.json(
            { pipeline: results, mode: effectiveMode, aborted_at: 'match-questions', error: 'Pipeline abgebrochen: Leitfaden-Fragen erstellen fehlgeschlagen' },
            { status: 500 }
          );
        }
        results.push({ step: 'match-questions', status: 'ok', data });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ step: 'match-questions', status: 'error', error: errorMsg });
        return NextResponse.json(
          { pipeline: results, mode: effectiveMode, aborted_at: 'match-questions', error: `Pipeline abgebrochen: ${errorMsg}` },
          { status: 500 }
        );
      }
    }
    // In incremental mode with guide, canonicals already exist → skip match-questions

    // Step 2: Segment answers (guide-direct prompt)
    const segmentBody = effectiveMode === 'incremental'
      ? { mode: 'incremental', interviewIds: newInterviewIds, guideDirect: true }
      : { mode: 'full', guideDirect: true };

    try {
      const res = await fetch(`${origin}/api/interview-analysis/projects/${projectId}/segment-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(segmentBody),
      });
      const data = await res.json();
      if (!res.ok) {
        results.push({ step: 'segment-answers', status: 'error', error: data.error });
        return NextResponse.json(
          { pipeline: results, mode: effectiveMode, aborted_at: 'segment-answers', error: 'Pipeline abgebrochen: Antwort-Zuordnung fehlgeschlagen' },
          { status: 500 }
        );
      }
      results.push({ step: 'segment-answers', status: 'ok', data });

      // Step 3: Process additional questions discovered during segmentation
      const additionalQuestions: Array<{
        interview_id: string;
        question: string;
        answer: string;
        topic: string;
      }> = data.additional_questions ?? [];

      if (additionalQuestions.length > 0) {
        await processAdditionalQuestions(projectId, additionalQuestions, sb);
        results.push({
          step: 'additional-questions',
          status: 'ok',
          data: { count: additionalQuestions.length },
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      results.push({ step: 'segment-answers', status: 'error', error: errorMsg });
      return NextResponse.json(
        { pipeline: results, mode: effectiveMode, aborted_at: 'segment-answers', error: `Pipeline abgebrochen: ${errorMsg}` },
        { status: 500 }
      );
    }
  } else {
    // ── TRACK B: Standard Pipeline (no guide) ───────────────────────────────
    const pipelineBody = effectiveMode === 'incremental'
      ? { mode: 'incremental', interviewIds: newInterviewIds }
      : { mode: 'full' };

    const steps = [
      { name: 'extract-questions', label: 'Fragen extrahieren' },
      { name: 'match-questions', label: 'Fragen matchen' },
      { name: 'segment-answers', label: 'Antworten segmentieren' },
    ];

    for (const step of steps) {
      try {
        const res = await fetch(`${origin}/api/interview-analysis/projects/${projectId}/${step.name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pipelineBody),
        });
        const data = await res.json();
        if (!res.ok) {
          results.push({ step: step.name, status: 'error', error: data.error });
          return NextResponse.json(
            { pipeline: results, mode: effectiveMode, aborted_at: step.name, error: `Pipeline abgebrochen: ${step.label} fehlgeschlagen` },
            { status: 500 }
          );
        }
        results.push({ step: step.name, status: 'ok', data });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ step: step.name, status: 'error', error: errorMsg });
        return NextResponse.json(
          { pipeline: results, mode: effectiveMode, aborted_at: step.name, error: `Pipeline abgebrochen: ${errorMsg}` },
          { status: 500 }
        );
      }
    }
  }

  // ── Generate summaries ────────────────────────────────────────────────────

  try {
    let canonicalIdsToSummarize: string[] = [];

    if (effectiveMode === 'incremental') {
      const segmentResult = results.find(r => r.step === 'segment-answers');
      canonicalIdsToSummarize =
        (segmentResult?.data as { affected_canonical_ids?: string[] })?.affected_canonical_ids ?? [];
    } else {
      // Full mode: summarize all canonicals
      const { data: allCanonicals } = await sb
        .from('ia_canonical_questions')
        .select('id')
        .eq('project_id', projectId);
      canonicalIdsToSummarize = (allCanonicals ?? []).map(c => c.id);
    }

    for (const cqId of canonicalIdsToSummarize) {
      try {
        await fetch(`${origin}/api/interview-analysis/projects/${projectId}/summarize-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canonicalQuestionId: cqId }),
        });
      } catch {
        // Non-critical, continue
      }
    }

    results.push({ step: 'summarize', status: 'ok', data: { count: canonicalIdsToSummarize.length } });
  } catch {
    results.push({ step: 'summarize', status: 'skipped' });
  }

  return NextResponse.json({
    pipeline: results,
    mode: effectiveMode,
    has_guide: hasGuide,
    ...(effectiveMode === 'incremental' ? { processed_interviews: newInterviewIds.length } : {}),
    ...(guideChanged ? { guide_changed: true } : {}),
  });
}

// ── Process additional questions from guide-direct segmentation ───────────────

async function processAdditionalQuestions(
  projectId: string,
  additionalQuestions: Array<{
    interview_id: string;
    question: string;
    answer: string;
    topic: string;
  }>,
  sb: ReturnType<typeof getServiceClient>,
) {
  // Group similar additional questions by text similarity
  const groups = new Map<string, {
    question: string;
    topic: string;
    entries: Array<{ interview_id: string; answer: string }>;
  }>();

  for (const aq of additionalQuestions) {
    const key = aq.question.toLowerCase().replace(/[?.!,;:]/g, '').trim();

    let matched = false;
    for (const [existingKey, group] of groups) {
      if (stringSimilarity(key, existingKey) > 0.7) {
        group.entries.push({ interview_id: aq.interview_id, answer: aq.answer });
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.set(key, {
        question: aq.question,
        topic: aq.topic,
        entries: [{ interview_id: aq.interview_id, answer: aq.answer }],
      });
    }
  }

  // Get current max sort_order
  const { data: lastCanonical } = await sb
    .from('ia_canonical_questions')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  let sortOrder = (lastCanonical?.sort_order ?? 0) + 1;

  for (const group of groups.values()) {
    const { data: canonical } = await sb
      .from('ia_canonical_questions')
      .insert({
        project_id: projectId,
        canonical_text: group.question,
        topic_area: group.topic,
        sort_order: sortOrder++,
        guide_question_id: null,
      })
      .select()
      .single();

    if (!canonical) continue;

    const answers = group.entries.map(e => ({
      interview_id: e.interview_id,
      canonical_question_id: canonical.id,
      answer_text: e.answer,
      word_count: e.answer.split(/\s+/).length,
      sentiment: 'neutral',
      confidence: 'medium',
      match_type: 'direct',
      follow_ups: [],
    }));

    await sb.from('ia_answers').insert(answers);
  }
}

// Simple string similarity (Dice coefficient on bigrams)
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));

  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));

  let intersection = 0;
  for (const bg of bigramsB) {
    if (bigramsA.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}
