import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import mammoth from 'mammoth';

export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = (formData.get('name') as string) || '';

  if (!file) {
    return NextResponse.json({ error: 'Keine Datei hochgeladen' }, { status: 400 });
  }

  if (!name.trim()) {
    return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract text from .docx using mammoth
  let text: string;
  try {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } catch {
    return NextResponse.json({ error: 'Datei konnte nicht gelesen werden. Ist es eine gültige .docx-Datei?' }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: 'Die Datei enthält keinen Text' }, { status: 400 });
  }

  const wordCount = text.trim().split(/\s+/).length;

  const sb = getServiceClient();

  const { data, error } = await sb
    .from('ia_interviews')
    .insert({
      project_id: projectId,
      name: name.trim(),
      metadata: { source_file: file.name },
      transcript_text: text,
      source_type: 'text',
      status: 'transcribed',
      word_count: wordCount,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
