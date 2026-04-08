import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export const maxDuration = 300;

type PipelineStatus = {
  running: boolean;
  mode?: string;
  step?: string;
  progress?: string;
  started_at?: string;
  finished_at?: string;
  error?: string | null;
};

async function getPipelineStatus(sb: ReturnType<typeof getServiceClient>, projectId: string): Promise<PipelineStatus> {
  try {
    const { data } = await sb
      .from('ia_projects')
      .select('pipeline_status')
      .eq('id', projectId)
      .single();
    if (data?.pipeline_status) return data.pipeline_status as PipelineStatus;
  } catch {
    // Column might not exist — ignore
  }
  return { running: false };
}

async function setPipelineStatus(sb: ReturnType<typeof getServiceClient>, projectId: string, status: PipelineStatus) {
  try {
    await sb.from('ia_projects').update({ pipeline_status: status }).eq('id', projectId);
  } catch {
    // Column might not exist — ignore silently
  }
}

// ── GET: Poll pipeline status ────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const sb = getServiceClient();
  const status = await getPipelineStatus(sb, projectId);
  return NextResponse.json(status);
}

// ── POST: Start pipeline (returns immediately, runs in background) ───────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const origin = req.nextUrl.origin;
    const body = await req.json().catch(() => ({}));
    const requestedMode: 'incremental' | 'full' = body.mode ?? 'incremental';

    const sb = getServiceClient();

    // Check if pipeline is already running
    const currentStatus = await getPipelineStatus(sb, projectId);
    if (currentStatus.running) {
      return NextResponse.json({
        error: 'Pipeline is already running',
        pipeline_status: currentStatus,
      }, { status: 409 });
    }

    // ── Gather project state ────────────────────────────────────────────────

    const { data: allInterviews } = await sb
      .from('ia_interviews')
      .select('id, status')
      .eq('project_id', projectId);

    const newInterviewIds = (allInterviews ?? [])
      .filter(i => i.status === 'transcribed')
      .map(i => i.id);

    const { count: canonicalCount } = await sb
      .from('ia_canonical_questions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const { count: guideCount } = await sb
      .from('ia_guide_questions')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const hasGuide = (guideCount ?? 0) > 0;

    let guideChanged = false;
    if ((canonicalCount ?? 0) > 0 && hasGuide) {
      const { count: linkedCount } = await sb
        .from('ia_canonical_questions')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .not('guide_question_id', 'is', null);
      guideChanged = (linkedCount ?? 0) === 0;
    }

    const effectiveMode: 'incremental' | 'full' =
      requestedMode === 'full' || (canonicalCount ?? 0) === 0 || guideChanged
        ? 'full'
        : 'incremental';

    if (effectiveMode === 'incremental' && newInterviewIds.length === 0) {
      return NextResponse.json({
        pipeline_status: { running: false },
        mode: 'incremental',
        message: 'No new interviews to analyze.',
      });
    }

    const totalInterviews = effectiveMode === 'full'
      ? (allInterviews ?? []).filter(i => ['transcribed', 'analyzed'].includes(i.status)).length
      : newInterviewIds.length;

    const initialStatus: PipelineStatus = {
      running: true,
      mode: effectiveMode,
      step: 'starting',
      progress: `0/${totalInterviews}`,
      started_at: new Date().toISOString(),
      error: null,
    };

    await setPipelineStatus(sb, projectId, initialStatus);

    // Run pipeline in background via next/server after()
    after(async () => {
      try {
        await runPipelineBackground(
          projectId,
          origin,
          effectiveMode,
          hasGuide,
          newInterviewIds,
          totalInterviews,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown background error';
        const sb2 = getServiceClient();
        await setPipelineStatus(sb2, projectId, {
          running: false,
          mode: effectiveMode,
          step: 'error',
          error: msg,
        });
      }
    });

    return NextResponse.json({
      pipeline_status: initialStatus,
      mode: effectiveMode,
      has_guide: hasGuide,
      background: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── Background pipeline execution ────────────────────────────────────────────

async function runPipelineBackground(
  projectId: string,
  origin: string,
  effectiveMode: 'incremental' | 'full',
  hasGuide: boolean,
  newInterviewIds: string[],
  totalInterviews: number,
) {
  const sb = getServiceClient();

  async function updateStatus(step: string, progress?: string, error?: string | null) {
    await setPipelineStatus(sb, projectId, {
      running: !error,
      mode: effectiveMode,
      step,
      progress: progress ?? `0/${totalInterviews}`,
      started_at: new Date().toISOString(),
      error: error ?? null,
    });
  }

  async function safeFetch(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data: Record<string, unknown>;
    try {
      data = await res.json();
    } catch {
      const text = await res.text().catch(() => 'Unknown response');
      data = { error: text };
    }
    return { ok: res.ok, data };
  }

  const results: Array<{ step: string; status: string; data?: unknown; error?: string }> = [];

  try {
    if (hasGuide) {
      // ── TRACK A: Guide-Direct Pipeline ──────────────────────────────────

      if (effectiveMode === 'full') {
        await updateStatus('match-questions', `0/${totalInterviews}`);
        const { ok, data } = await safeFetch(
          `${origin}/api/interview-analysis/projects/${projectId}/match-questions`,
          { guideDirect: true },
        );
        if (!ok) {
          await updateStatus('match-questions', undefined, String(data.error || 'Failed'));
          return;
        }
        results.push({ step: 'match-questions', status: 'ok', data });
      }

      await updateStatus('segment-answers', `0/${totalInterviews}`);
      const segmentBody = effectiveMode === 'incremental'
        ? { mode: 'incremental', interviewIds: newInterviewIds, guideDirect: true }
        : { mode: 'full', guideDirect: true };

      const { ok, data } = await safeFetch(
        `${origin}/api/interview-analysis/projects/${projectId}/segment-answers`,
        segmentBody,
      );
      if (!ok) {
        await updateStatus('segment-answers', undefined, String(data.error || 'Failed'));
        return;
      }
      results.push({ step: 'segment-answers', status: 'ok', data });

      const additionalQuestions = (data.additional_questions ?? []) as Array<{
        interview_id: string;
        question: string;
        answer: string;
        topic: string;
      }>;

      if (additionalQuestions.length > 0) {
        await processAdditionalQuestions(projectId, additionalQuestions, sb);
      }
    } else {
      // ── TRACK B: Standard Pipeline (no guide) ─────────────────────────

      const pipelineBody = effectiveMode === 'incremental'
        ? { mode: 'incremental', interviewIds: newInterviewIds }
        : { mode: 'full' };

      const steps = [
        { name: 'extract-questions', label: 'Extracting questions' },
        { name: 'match-questions', label: 'Matching questions' },
        { name: 'segment-answers', label: 'Segmenting answers' },
      ];

      for (const step of steps) {
        await updateStatus(step.name, `0/${totalInterviews}`);
        const { ok, data } = await safeFetch(
          `${origin}/api/interview-analysis/projects/${projectId}/${step.name}`,
          pipelineBody,
        );
        if (!ok) {
          await updateStatus(step.name, undefined, String(data.error || `${step.label} failed`));
          return;
        }
        results.push({ step: step.name, status: 'ok', data });
      }
    }

    // ── Generate summaries ──────────────────────────────────────────────────

    await updateStatus('summarize', `0/${totalInterviews}`);

    let canonicalIdsToSummarize: string[] = [];
    if (effectiveMode === 'incremental') {
      const segmentResult = results.find(r => r.step === 'segment-answers');
      canonicalIdsToSummarize =
        (segmentResult?.data as { affected_canonical_ids?: string[] })?.affected_canonical_ids ?? [];
    } else {
      const { data: allCanonicals } = await sb
        .from('ia_canonical_questions')
        .select('id')
        .eq('project_id', projectId);
      canonicalIdsToSummarize = (allCanonicals ?? []).map(c => c.id);
    }

    for (let i = 0; i < canonicalIdsToSummarize.length; i++) {
      await updateStatus('summarize', `${i + 1}/${canonicalIdsToSummarize.length}`);
      try {
        await safeFetch(
          `${origin}/api/interview-analysis/projects/${projectId}/summarize-question`,
          { canonicalQuestionId: canonicalIdsToSummarize[i] },
        );
      } catch {
        // Non-critical
      }
    }

    // ── Done ────────────────────────────────────────────────────────────────

    await setPipelineStatus(sb, projectId, {
      running: false,
      mode: effectiveMode,
      step: 'done',
      progress: `${totalInterviews}/${totalInterviews}`,
      finished_at: new Date().toISOString(),
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await updateStatus('error', undefined, msg);
  }
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
