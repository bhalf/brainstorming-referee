import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ projectId: string; interviewId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId, interviewId } = await params;
  const sb = getServiceClient();

  const { data, error } = await sb
    .from('ia_interviews')
    .select('*')
    .eq('id', interviewId)
    .eq('project_id', projectId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId, interviewId } = await params;
  const body = await req.json();
  const sb = getServiceClient();

  const VALID_STATUSES = ['pending', 'transcribing', 'transcribed', 'analyzed'];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.metadata !== undefined) updates.metadata = body.metadata;
  if (body.transcript_text !== undefined) {
    updates.transcript_text = body.transcript_text;
    updates.word_count = body.transcript_text
      ? body.transcript_text.trim().split(/\s+/).length
      : null;
  }
  if (body.group_label !== undefined) updates.group_label = body.group_label || null;
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Must be: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
    }
    updates.status = body.status;
  }

  const { data, error } = await sb
    .from('ia_interviews')
    .update(updates)
    .eq('id', interviewId)
    .eq('project_id', projectId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { projectId, interviewId } = await params;
  const sb = getServiceClient();

  // Delete the interview (cascades to ia_questions, ia_answers)
  const { error } = await sb
    .from('ia_interviews')
    .delete()
    .eq('id', interviewId)
    .eq('project_id', projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clean up orphaned canonical questions (no remaining mappings or answers)
  const { data: canonicals } = await sb
    .from('ia_canonical_questions')
    .select('id')
    .eq('project_id', projectId);

  if (canonicals?.length) {
    for (const c of canonicals) {
      const { count: mappingCount } = await sb
        .from('ia_question_mappings')
        .select('*', { count: 'exact', head: true })
        .eq('canonical_question_id', c.id);

      const { count: answerCount } = await sb
        .from('ia_answers')
        .select('*', { count: 'exact', head: true })
        .eq('canonical_question_id', c.id);

      if ((mappingCount ?? 0) === 0 && (answerCount ?? 0) === 0) {
        await sb.from('ia_question_summaries').delete().eq('canonical_question_id', c.id);
        await sb.from('ia_canonical_questions').delete().eq('id', c.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
