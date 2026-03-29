import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const sb = getServiceClient();

  const { data: codes } = await sb
    .from('ia_codes')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');

  const codeIds = (codes ?? []).map(c => c.id);
  if (codeIds.length === 0) {
    return NextResponse.json({ frequencies: [], co_occurrences: [] });
  }

  const { data: assignments } = await sb
    .from('ia_code_assignments')
    .select('id, code_id, answer_id, ia_answers!inner(interview_id, canonical_question_id)')
    .in('code_id', codeIds);

  // Frequency per code
  const freqMap = new Map<string, { count: number; interviews: Set<string>; questions: Set<string> }>();
  for (const c of codes ?? []) {
    freqMap.set(c.id, { count: 0, interviews: new Set(), questions: new Set() });
  }

  for (const a of assignments ?? []) {
    const f = freqMap.get(a.code_id);
    if (!f) continue;
    f.count++;
    const answer = a.ia_answers as unknown as { interview_id: string; canonical_question_id: string };
    f.interviews.add(answer.interview_id);
    f.questions.add(answer.canonical_question_id);
  }

  const frequencies = (codes ?? []).map(c => {
    const f = freqMap.get(c.id)!;
    return {
      code: c,
      count: f.count,
      interview_count: f.interviews.size,
      question_count: f.questions.size,
    };
  });

  // Co-occurrence: group assignments by answer_id, then count code pairs
  const byAnswer = new Map<string, Set<string>>();
  for (const a of assignments ?? []) {
    const set = byAnswer.get(a.answer_id) ?? new Set<string>();
    set.add(a.code_id);
    byAnswer.set(a.answer_id, set);
  }

  const coMap = new Map<string, number>();
  for (const [, codeSet] of byAnswer) {
    const arr = Array.from(codeSet);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = [arr[i], arr[j]].sort().join('|');
        coMap.set(key, (coMap.get(key) ?? 0) + 1);
      }
    }
  }

  const co_occurrences = Array.from(coMap.entries()).map(([key, count]) => {
    const [a, b] = key.split('|');
    return { code_a_id: a, code_b_id: b, count };
  });

  return NextResponse.json({ frequencies, co_occurrences });
}
