import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

// POST — Insert connection (idempotent via ON CONFLICT)
export async function POST(request: NextRequest) {
  try {
    const { sessionId, connection } = await request.json();

    if (!sessionId || !connection) {
      return NextResponse.json({ error: 'sessionId and connection required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { error } = await supabase
      .from('idea_connections')
      .upsert(
        {
          id: connection.id,
          session_id: sessionId,
          source_idea_id: connection.sourceIdeaId,
          target_idea_id: connection.targetIdeaId,
          label: connection.label ?? null,
          connection_type: connection.connectionType ?? 'related',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (error) {
      console.error('Failed to insert idea connection:', error);
      return NextResponse.json({ error: 'Failed to insert connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Idea connections POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — Fetch connections for session
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('idea_connections')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch idea connections:', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }

  return NextResponse.json({ connections: data || [] });
}
