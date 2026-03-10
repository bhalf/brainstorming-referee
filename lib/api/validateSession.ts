import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

/**
 * Validate that a sessionId exists and is a valid UUID format.
 * Returns the session row if valid, or a NextResponse error.
 */
export async function validateSessionExists(
  sessionId: string | null | undefined,
): Promise<{ valid: true; session: { id: string; room_name: string; host_identity: string; ended_at: string | null } } | { valid: false; response: NextResponse }> {
  if (!sessionId || typeof sessionId !== 'string') {
    return { valid: false, response: NextResponse.json({ error: 'sessionId required' }, { status: 400 }) };
  }

  // Basic UUID format check
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    return { valid: false, response: NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 }) };
  }

  const supabase = getServiceClient();
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, room_name, host_identity, ended_at')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return { valid: false, response: NextResponse.json({ error: 'Session not found' }, { status: 404 }) };
  }

  return { valid: true, session };
}
