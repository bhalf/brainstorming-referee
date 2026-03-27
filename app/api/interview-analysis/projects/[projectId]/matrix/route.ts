import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const sb = getServiceClient();

  // First fetch canonicals and interviews in parallel
  const [{ data: interviews }, { data: canonicals }] = await Promise.all([
    sb.from('ia_interviews').select('*').eq('project_id', projectId).order('created_at'),
    sb.from('ia_canonical_questions').select('*').eq('project_id', projectId).order('sort_order'),
  ]);

  // Single canonical ID list (was queried 3x before)
  const canonicalIds = (canonicals ?? []).map(c => c.id);

  // Now fetch dependent data in parallel using the single ID list
  const [{ data: answers }, { data: summaries }, { data: mappings }] = canonicalIds.length > 0
    ? await Promise.all([
        sb.from('ia_answers').select('*').in('canonical_question_id', canonicalIds),
        sb.from('ia_question_summaries').select('*').in('canonical_question_id', canonicalIds),
        sb.from('ia_question_mappings').select('*, ia_questions(*)').in('canonical_question_id', canonicalIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const interviewMap = new Map((interviews ?? []).map(i => [i.id, i]));
  const totalInterviews = (interviews ?? []).filter(i => ['transcribed', 'analyzed'].includes(i.status)).length;

  const questions = (canonicals ?? []).map(cq => {
    const cqAnswers = (answers ?? [])
      .filter(a => a.canonical_question_id === cq.id)
      .map(a => ({
        ...a,
        interview_name: interviewMap.get(a.interview_id)?.name ?? 'Unbekannt',
      }));

    const summary = (summaries ?? []).find(s => s.canonical_question_id === cq.id) ?? null;
    const cqMappings = (mappings ?? []).filter((m: { canonical_question_id: string }) => m.canonical_question_id === cq.id);

    return {
      canonical: cq,
      answers: cqAnswers,
      coverage: cqAnswers.length,
      total_interviews: totalInterviews,
      summary,
      mappings: cqMappings,
    };
  });

  return NextResponse.json({
    questions,
    interviews: interviews ?? [],
  });
}
