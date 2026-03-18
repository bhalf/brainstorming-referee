import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';
import { rateLimit } from '@/lib/api/rateLimit';
import { getConnectionReviewSystemPrompt } from '@/lib/prompts/extraction/connectionReview';

const VALID_CONNECTION_TYPES = new Set(['builds_on', 'contrasts', 'supports', 'leads_to', 'related']);

interface ReviewRequest {
  ideas: { id: string; title: string; description?: string | null; ideaType?: string }[];
  existingConnections: { id: string; sourceId: string; sourceTitle: string; targetId: string; targetTitle: string; type: string }[];
  language: string;
}

/**
 * POST /api/ideas/review-connections — LLM-based review of idea connections.
 *
 * Periodically reviews ALL ideas and their connections to add missing ones,
 * remove incorrect ones, and update wrong types.
 *
 * Rate-limited to 10 requests per window.
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 10 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as ReviewRequest;
    const { ideas = [], existingConnections = [], language = 'en-US' } = body;

    if (ideas.length < 3) {
      return NextResponse.json({ add: [], remove: [], update: [], logEntry: null });
    }

    const apiKeyResult = requireApiKey();
    if ('error' in apiKeyResult) return apiKeyResult.error;
    const apiKey = apiKeyResult.key;

    const routingConfig = loadRoutingConfig();

    // Build the user prompt with all ideas and connections
    const ideasList = ideas.map(i =>
      `- [ID: ${i.id}] "${i.title}"${i.description ? ` — ${i.description}` : ''}${i.ideaType === 'category' ? ' (CATEGORY)' : i.ideaType === 'action_item' ? ' (ACTION ITEM)' : ''}`
    ).join('\n');

    const connsList = existingConnections.length > 0
      ? existingConnections.map(c =>
          `- [CONN-ID: ${c.id}] "${c.sourceTitle}" (${c.sourceId}) → "${c.targetTitle}" (${c.targetId}) [${c.type}]`
        ).join('\n')
      : 'No connections yet.';

    const userPrompt = `Current ideas (${ideas.length}):\n${ideasList}\n\nExisting connections (${existingConnections.length}):\n${connsList}`;

    console.log(`[ConnectionReview] Reviewing ${ideas.length} ideas, ${existingConnections.length} connections`);

    try {
      const { text, logEntry } = await callLLM(
        'connection_review',
        routingConfig,
        [
          { role: 'system', content: getConnectionReviewSystemPrompt(language) },
          { role: 'user', content: userPrompt },
        ],
        apiKey,
        { responseFormat: { type: 'json_object' } }
      );

      let parsed: {
        add?: Array<{ sourceId: string; targetId: string; type: string; label?: string }>;
        remove?: string[];
        update?: Array<{ id: string; type: string; label?: string }>;
      };
      try {
        parsed = JSON.parse(text);
      } catch {
        console.error('[ConnectionReview] Failed to parse response:', text);
        return NextResponse.json({ add: [], remove: [], update: [], logEntry });
      }

      // Validate referenced IDs
      const ideaIdSet = new Set(ideas.map(i => i.id));
      const connIdSet = new Set(existingConnections.map(c => c.id));

      // Validate and filter additions
      const validAdds = (parsed.add || []).filter(a => {
        if (!ideaIdSet.has(a.sourceId) || !ideaIdSet.has(a.targetId)) return false;
        if (a.sourceId === a.targetId) return false;
        if (!VALID_CONNECTION_TYPES.has(a.type)) return false;
        return true;
      }).slice(0, 5).map(a => ({
        sourceId: a.sourceId,
        targetId: a.targetId,
        type: a.type,
        label: a.label?.trim() || null,
      }));

      // Validate removals
      const validRemoves = (parsed.remove || []).filter(id => connIdSet.has(id));

      // Validate updates
      const validUpdates = (parsed.update || []).filter(u => {
        if (!connIdSet.has(u.id)) return false;
        if (!VALID_CONNECTION_TYPES.has(u.type)) return false;
        return true;
      }).map(u => ({
        id: u.id,
        type: u.type,
        label: u.label?.trim() || null,
      }));

      console.log(`[ConnectionReview] Result: +${validAdds.length} add, -${validRemoves.length} remove, ~${validUpdates.length} update`);

      return NextResponse.json({
        add: validAdds,
        remove: validRemoves,
        update: validUpdates,
        logEntry,
      });
    } catch (error) {
      const logEntry = error instanceof LLMError ? error.logEntry : null;
      console.error('[ConnectionReview] LLM call failed:', error);
      return NextResponse.json({ add: [], remove: [], update: [], logEntry });
    }
  } catch (error) {
    console.error('[ConnectionReview] Endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
