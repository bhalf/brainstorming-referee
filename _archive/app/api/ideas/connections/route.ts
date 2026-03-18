import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/ideas/connections — Insert an idea connection (idempotent).
 *
 * Creates a directional link between two ideas (e.g. builds_on, contrasts).
 * Uses Supabase upsert with ON CONFLICT on the connection id.
 *
 * @param request.body.sessionId - UUID of the owning session.
 * @param request.body.connection - Connection object with id, sourceIdeaId, targetIdeaId,
 *        and optional label and connectionType (defaults to 'related').
 * @returns {{ success: true }} on successful insert.
 */
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

/**
 * DELETE /api/ideas/connections — Delete a connection by ID.
 *
 * @param request.body.connectionId - UUID of the connection to delete.
 * @returns {{ success: true }} on successful deletion.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { connectionId } = await request.json();

    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { error } = await supabase
      .from('idea_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      console.error('Failed to delete idea connection:', error);
      return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Idea connections DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/ideas/connections — Update a connection's type and/or label.
 *
 * @param request.body.connectionId - UUID of the connection to update.
 * @param request.body.updates - Partial fields (connectionType, label) to merge.
 * @returns {{ success: true }} on successful update.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { connectionId, updates } = await request.json();

    if (!connectionId || !updates) {
      return NextResponse.json({ error: 'connectionId and updates required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const dbUpdates: Record<string, unknown> = {};
    if (updates.connectionType) dbUpdates.connection_type = updates.connectionType;
    if (updates.label !== undefined) dbUpdates.label = updates.label;

    const { error } = await supabase
      .from('idea_connections')
      .update(dbUpdates)
      .eq('id', connectionId);

    if (error) {
      console.error('Failed to update idea connection:', error);
      return NextResponse.json({ error: 'Failed to update connection' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Idea connections PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ideas/connections?sessionId={id} — Fetch all idea connections for a session.
 *
 * @param request.query.sessionId - UUID of the session.
 * @returns {{ connections: object[] }} Array of raw connection rows ordered by creation time.
 */
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
