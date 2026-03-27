import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const sb = getServiceClient();

  const { data, error } = await sb
    .from('ia_guide_questions')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const sb = getServiceClient();

  await sb.from('ia_guide_questions').delete().eq('project_id', projectId);
  await sb.from('ia_projects').update({ guide_raw_text: null }).eq('id', projectId);

  return NextResponse.json({ ok: true });
}
