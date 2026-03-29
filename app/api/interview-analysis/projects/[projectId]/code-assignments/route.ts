import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ projectId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const answerId = req.nextUrl.searchParams.get('answer_id');
  const sb = getServiceClient();

  // Get all code IDs for this project first
  const { data: codes } = await sb
    .from('ia_codes')
    .select('id')
    .eq('project_id', projectId);

  const codeIds = (codes ?? []).map(c => c.id);
  if (codeIds.length === 0) {
    return NextResponse.json([]);
  }

  let query = sb
    .from('ia_code_assignments')
    .select('*, ia_codes(*)')
    .in('code_id', codeIds)
    .order('created_at');

  if (answerId) {
    query = query.eq('answer_id', answerId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the join: rename ia_codes to code
  const result = (data ?? []).map(row => {
    const { ia_codes, ...rest } = row as Record<string, unknown>;
    return { ...rest, code: ia_codes };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json();
  const { code_id, answer_id, start_offset, end_offset, selected_text, memo } = body;

  if (!code_id || !answer_id || start_offset == null || end_offset == null || !selected_text) {
    return NextResponse.json({ error: 'code_id, answer_id, start_offset, end_offset, and selected_text are required' }, { status: 400 });
  }

  const sb = getServiceClient();

  // Verify code belongs to project
  const { data: code } = await sb
    .from('ia_codes')
    .select('id')
    .eq('id', code_id)
    .eq('project_id', projectId)
    .single();

  if (!code) {
    return NextResponse.json({ error: 'Code not found in this project' }, { status: 404 });
  }

  // Verify answer exists and validate offsets
  const { data: answer } = await sb
    .from('ia_answers')
    .select('answer_text')
    .eq('id', answer_id)
    .single();

  if (!answer) {
    return NextResponse.json({ error: 'Answer not found' }, { status: 404 });
  }

  if (start_offset < 0 || end_offset > answer.answer_text.length || start_offset >= end_offset) {
    return NextResponse.json({ error: 'Invalid offsets' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('ia_code_assignments')
    .insert({
      code_id,
      answer_id,
      start_offset,
      end_offset,
      selected_text,
      memo: memo || null,
    })
    .select('*, ia_codes(*)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { ia_codes, ...rest } = data as Record<string, unknown>;
  return NextResponse.json({ ...rest, code: ia_codes }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const sb = getServiceClient();

  // Verify the assignment belongs to a code in this project
  const { data: assignment } = await sb
    .from('ia_code_assignments')
    .select('code_id, ia_codes!inner(project_id)')
    .eq('id', id)
    .single();

  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  const assignmentProject = (assignment as Record<string, unknown>).ia_codes as { project_id: string } | null;
  if (assignmentProject?.project_id !== projectId) {
    return NextResponse.json({ error: 'Assignment not in this project' }, { status: 403 });
  }

  const { error } = await sb
    .from('ia_code_assignments')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
