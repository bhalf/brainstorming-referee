import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { validateSessionExists } from '@/lib/api/validateSession';

/**
 * POST /api/ideas — Insert a new idea (idempotent).
 *
 * Uses Supabase upsert with ON CONFLICT on the idea id so duplicate
 * submissions are silently ignored. Supports all idea fields including
 * type (idea/category/action_item) and hierarchical parent references.
 *
 * @param request.body.sessionId - UUID of the owning session.
 * @param request.body.idea - Idea object with id, title, author, and optional fields
 *        (description, source, sourceSegmentIds, positionX/Y, color, ideaType, parentId).
 * @returns {{ success: true }} on successful insert.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId, idea } = await request.json();

    if (!sessionId || !idea) {
      return NextResponse.json({ error: 'sessionId and idea required' }, { status: 400 });
    }

    const validation = await validateSessionExists(sessionId);
    if (!validation.valid) return validation.response;

    const supabase = getServiceClient();

    const { error } = await supabase
      .from('ideas')
      .upsert(
        {
          id: idea.id,
          session_id: sessionId,
          title: idea.title,
          description: idea.description ?? null,
          author: idea.author,
          source: idea.source ?? 'manual',
          source_segment_ids: idea.sourceSegmentIds ?? [],
          position_x: idea.positionX ?? 0,
          position_y: idea.positionY ?? 0,
          color: idea.color ?? 'yellow',
          is_deleted: idea.isDeleted ?? false,
          idea_type: idea.ideaType ?? 'idea',
          parent_id: idea.parentId ?? null,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (error) {
      console.error('Failed to insert idea:', error);
      return NextResponse.json({ error: 'Failed to insert idea' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ideas POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/ideas?sessionId={id} — Fetch all active ideas for a session.
 *
 * Returns non-deleted ideas ordered by creation time. Used for initial hydration
 * when a participant joins mid-session.
 *
 * @param request.query.sessionId - UUID of the session.
 * @returns {{ ideas: object[] }} Array of raw idea rows.
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const validation = await validateSessionExists(sessionId);
  if (!validation.valid) return validation.response;

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('ideas')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch ideas:', error);
    return NextResponse.json({ error: 'Failed to fetch ideas' }, { status: 500 });
  }

  return NextResponse.json({ ideas: data || [] });
}

/**
 * PATCH /api/ideas — Update an existing idea's mutable fields.
 *
 * Supports partial updates to position, color, title, description, type,
 * parent, and soft-delete flag. Only provided fields are written;
 * updated_at is always refreshed.
 *
 * @param request.body.id - UUID of the idea to update.
 * @param request.body.updates - Partial object with any of: positionX, positionY,
 *        color, isDeleted, title, description, ideaType, parentId.
 * @returns {{ success: true }} on successful update.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { id, updates } = await request.json();

    if (!id || !updates) {
      return NextResponse.json({ error: 'id and updates required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Map camelCase client fields to snake_case DB columns; only include provided fields
    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.positionX !== undefined) dbUpdates.position_x = updates.positionX;
    if (updates.positionY !== undefined) dbUpdates.position_y = updates.positionY;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.isDeleted !== undefined) dbUpdates.is_deleted = updates.isDeleted;
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.ideaType !== undefined) dbUpdates.idea_type = updates.ideaType;
    if (updates.parentId !== undefined) dbUpdates.parent_id = updates.parentId;

    const { error } = await supabase
      .from('ideas')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Failed to update idea:', error);
      return NextResponse.json({ error: 'Failed to update idea' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ideas PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
