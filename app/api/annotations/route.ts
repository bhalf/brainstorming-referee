import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { validateSessionExists } from '@/lib/api/validateSession';

// GET — Fetch annotations for a session
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const validation = await validateSessionExists(sessionId);
  if (!validation.valid) return validation.response;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('intervention_annotations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at');

  if (error) {
    console.error('Failed to fetch annotations:', error);
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
  }

  const annotations = (data || []).map(row => ({
    id: row.id,
    interventionId: row.intervention_id,
    sessionId: row.session_id,
    rating: row.rating,
    relevance: row.relevance,
    effectiveness: row.effectiveness,
    notes: row.notes,
    annotator: row.annotator,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }));

  return NextResponse.json({ annotations });
}

// POST — Create or update an annotation (upsert by intervention_id + annotator)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { interventionId, sessionId, rating, relevance, effectiveness, notes, annotator } = body;

    if (!interventionId || !sessionId) {
      return NextResponse.json({ error: 'interventionId and sessionId required' }, { status: 400 });
    }

    const validation = await validateSessionExists(sessionId);
    if (!validation.valid) return validation.response;

    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('intervention_annotations')
      .upsert(
        {
          intervention_id: interventionId,
          session_id: sessionId,
          rating: rating ?? null,
          relevance: relevance ?? null,
          effectiveness: effectiveness ?? null,
          notes: notes ?? null,
          annotator: annotator || 'anonymous',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'intervention_id,annotator' }
      )
      .select('id')
      .single();

    if (error) {
      console.error('Failed to save annotation:', error);
      return NextResponse.json({ error: 'Failed to save annotation' }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error('Annotation save error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
