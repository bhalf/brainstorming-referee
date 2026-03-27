import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { interviewIds, group_label } = body as { interviewIds?: string[]; group_label?: string | null };

  if (!Array.isArray(interviewIds) || interviewIds.length === 0) {
    return NextResponse.json({ error: 'interviewIds array is required' }, { status: 400 });
  }

  const sb = getServiceClient();

  const { data, error } = await sb
    .from('ia_interviews')
    .update({ group_label: group_label || null, updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .in('id', interviewIds)
    .select('id, group_label');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
