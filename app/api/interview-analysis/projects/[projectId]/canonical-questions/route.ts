import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ projectId: string }> };

/**
 * PATCH: Reassign a single question mapping to a different canonical question
 * Body: { mappingId: string, targetCanonicalId: string }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json();
  const { mappingId, targetCanonicalId } = body;

  if (!mappingId || !targetCanonicalId) {
    return NextResponse.json({ error: 'mappingId and targetCanonicalId required' }, { status: 400 });
  }

  const sb = getServiceClient();

  // Load the mapping to find source canonical
  const { data: mapping } = await sb
    .from('ia_question_mappings')
    .select('*, ia_canonical_questions!inner(project_id)')
    .eq('id', mappingId)
    .single();

  if (!mapping) {
    return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
  }

  // Verify project ownership
  if ((mapping.ia_canonical_questions as { project_id: string }).project_id !== projectId) {
    return NextResponse.json({ error: 'Mapping does not belong to this project' }, { status: 403 });
  }

  // Verify target canonical exists and belongs to same project
  const { data: target } = await sb
    .from('ia_canonical_questions')
    .select('id')
    .eq('id', targetCanonicalId)
    .eq('project_id', projectId)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Target canonical question not found' }, { status: 404 });
  }

  const sourceCanonicalId = mapping.canonical_question_id;

  // Move the mapping
  await sb
    .from('ia_question_mappings')
    .update({ canonical_question_id: targetCanonicalId })
    .eq('id', mappingId);

  // Check if source canonical is now orphaned (no mappings AND no answers)
  let sourceDeleted = false;
  const { count: remainingMappings } = await sb
    .from('ia_question_mappings')
    .select('*', { count: 'exact', head: true })
    .eq('canonical_question_id', sourceCanonicalId);

  const { count: remainingAnswers } = await sb
    .from('ia_answers')
    .select('*', { count: 'exact', head: true })
    .eq('canonical_question_id', sourceCanonicalId);

  if ((remainingMappings ?? 0) === 0 && (remainingAnswers ?? 0) === 0) {
    await sb.from('ia_question_summaries').delete().eq('canonical_question_id', sourceCanonicalId);
    await sb.from('ia_canonical_questions').delete().eq('id', sourceCanonicalId);
    sourceDeleted = true;
  }

  return NextResponse.json({ ok: true, source_deleted: sourceDeleted });
}

/**
 * POST: Merge two canonical questions (source → target)
 * Body: { sourceId: string, targetId: string }
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json();
  const { sourceId, targetId } = body;

  if (!sourceId || !targetId) {
    return NextResponse.json({ error: 'sourceId and targetId required' }, { status: 400 });
  }

  if (sourceId === targetId) {
    return NextResponse.json({ error: 'Cannot merge a question with itself' }, { status: 400 });
  }

  const sb = getServiceClient();

  // Verify both canonicals exist and belong to this project
  const { data: source } = await sb
    .from('ia_canonical_questions')
    .select('id')
    .eq('id', sourceId)
    .eq('project_id', projectId)
    .single();

  const { data: target } = await sb
    .from('ia_canonical_questions')
    .select('id')
    .eq('id', targetId)
    .eq('project_id', projectId)
    .single();

  if (!source || !target) {
    return NextResponse.json({ error: 'Source or target canonical question not found' }, { status: 404 });
  }

  // 1. Count then move all mappings from source → target
  const { count: movedMappings } = await sb
    .from('ia_question_mappings')
    .select('*', { count: 'exact', head: true })
    .eq('canonical_question_id', sourceId);

  await sb
    .from('ia_question_mappings')
    .update({ canonical_question_id: targetId })
    .eq('canonical_question_id', sourceId);

  // 2. Count then move all answers from source → target
  const { count: movedAnswers } = await sb
    .from('ia_answers')
    .select('*', { count: 'exact', head: true })
    .eq('canonical_question_id', sourceId);

  await sb
    .from('ia_answers')
    .update({ canonical_question_id: targetId })
    .eq('canonical_question_id', sourceId);

  // 3. Delete source summary
  await sb.from('ia_question_summaries').delete().eq('canonical_question_id', sourceId);

  // 4. Delete source canonical
  await sb.from('ia_canonical_questions').delete().eq('id', sourceId);

  // 5. Re-index sort_order for remaining canonicals
  const { data: remaining } = await sb
    .from('ia_canonical_questions')
    .select('id')
    .eq('project_id', projectId)
    .order('sort_order');

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      await sb
        .from('ia_canonical_questions')
        .update({ sort_order: i })
        .eq('id', remaining[i].id);
    }
  }

  return NextResponse.json({
    ok: true,
    moved_mappings: movedMappings ?? 0,
    moved_answers: movedAnswers ?? 0,
  });
}
