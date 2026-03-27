import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const sb = getServiceClient();

  const { data, error } = await sb
    .from('ia_interviews')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { name, metadata, transcript_text, source_type } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const sb = getServiceClient();

  const wordCount = transcript_text
    ? transcript_text.trim().split(/\s+/).length
    : null;

  const { data, error } = await sb
    .from('ia_interviews')
    .insert({
      project_id: projectId,
      name: name.trim(),
      metadata: metadata || {},
      group_label: body.group_label || null,
      transcript_text: transcript_text || null,
      source_type: source_type || (transcript_text ? 'text' : 'audio'),
      status: transcript_text ? 'transcribed' : 'pending',
      word_count: wordCount,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
