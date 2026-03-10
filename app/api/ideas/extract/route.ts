import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';
import { rateLimit } from '@/lib/api/rateLimit';
import { getExtractionSystemPrompt } from '@/lib/prompts/extraction/prompts';

interface ExtractionRequest {
  segments: { id: string; speaker: string; text: string }[];
  contextSegments?: { id: string; speaker: string; text: string }[];
  existingTitles: string[];
  existingIdeas: { id: string; title: string; description?: string | null; ideaType?: string }[];
  language: string;
}

// --- System prompt now managed centrally in lib/prompts/extraction/prompts.ts ---

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 30 });
  if (limited) return limited;

  try {
    const body = (await request.json()) as ExtractionRequest;
    const { segments, contextSegments = [], existingTitles = [], existingIdeas = [], language = 'en-US' } = body;

    if (!segments || segments.length === 0) {
      return NextResponse.json({ ideas: [], connections: [], logEntry: null });
    }

    const apiKeyResult = requireApiKey();
    if ('error' in apiKeyResult) return apiKeyResult.error;
    const apiKey = apiKeyResult.key;

    const routingConfig = loadRoutingConfig();

    // Build transcript with context marker so the LLM knows which segments are new
    let transcriptText = '';
    if (contextSegments.length > 0) {
      transcriptText += '--- PRIOR CONTEXT (already processed, do NOT re-extract ideas from these) ---\n';
      transcriptText += contextSegments
        .map(s => `[${s.speaker}]: ${s.text}`)
        .join('\n');
      transcriptText += '\n\n--- NEW SEGMENTS (extract ideas ONLY from these) ---\n';
    }
    transcriptText += segments
      .map(s => `[${s.speaker}] (id: ${s.id}): ${s.text}`)
      .join('\n');

    console.log(`[IdeaExtraction] Processing ${segments.length} new + ${contextSegments.length} context segments (${existingIdeas.length} existing ideas)`);

    const existingList = existingIdeas.length > 0
      ? `Existing ideas (do NOT repeat these, but you CAN create connections TO them using their ID):\n${existingIdeas.map(ei => `- [ID: ${ei.id}] "${ei.title}"${ei.description ? ` — ${ei.description}` : ''}${ei.ideaType === 'category' ? ' (CATEGORY)' : ''}`).join('\n')}`
      : 'No existing ideas yet.';

    const userPrompt = `${existingList}\n\nRecent transcript segments:\n${transcriptText}`;

    try {
      const { text, logEntry } = await callLLM(
        'idea_extraction',
        routingConfig,
        [
          { role: 'system', content: getExtractionSystemPrompt(language) },
          { role: 'user', content: userPrompt },
        ],
        apiKey,
        { responseFormat: { type: 'json_object' } }
      );

      let parsed: {
        ideas: Array<{ title: string; description?: string; author: string; sourceSegmentIds?: string[]; type?: 'idea' | 'category' | 'action_item'; parentTitle?: string | null; parentId?: string | null }>;
        connections?: Array<{ sourceTitle: string; targetTitle: string; sourceId?: string | null; targetId?: string | null; label?: string; type?: string }>;
      };
      try {
        parsed = JSON.parse(text);
      } catch {
        console.error('Failed to parse idea extraction response:', text);
        return NextResponse.json({ ideas: [], connections: [], logEntry });
      }

      if (!parsed.ideas || !Array.isArray(parsed.ideas)) {
        console.log('[IdeaExtraction] LLM returned no ideas array');
        return NextResponse.json({ ideas: [], connections: [], logEntry });
      }

      // Filter out ideas that match existing titles (case-insensitive exact dedup)
      // Only exact matches — substring checks are too aggressive and filter out
      // legitimate ideas (e.g. "Wald" would incorrectly block "Waldbrand verhindern")
      const existingLower = new Set(existingTitles.map(t => t.toLowerCase().trim()));
      const filteredIdeas = parsed.ideas.filter(idea => {
        if (!idea.title || idea.title.trim().length === 0) return false;
        return !existingLower.has(idea.title.toLowerCase().trim());
      });

      console.log(`[IdeaExtraction] LLM returned ${parsed.ideas.length} ideas, ${filteredIdeas.length} after dedup, ${parsed.connections?.length || 0} connections`);
      if (filteredIdeas.length > 0) {
        console.log('[IdeaExtraction] Ideas:', filteredIdeas.map(i => `"${i.title}" (${i.author})`).join(', '));
      }

      // Build title→id map for resolving connections and parentId
      const titleToIdMap = new Map<string, string>();
      for (const ei of existingIdeas) {
        titleToIdMap.set(ei.title.toLowerCase().trim(), ei.id);
      }

      // Process connections — resolve IDs via map if the LLM didn't provide them
      const connections = (parsed.connections || [])
        .filter(c => c.sourceTitle && c.targetTitle && c.sourceTitle !== c.targetTitle)
        .map(c => ({
          sourceTitle: c.sourceTitle.trim(),
          targetTitle: c.targetTitle.trim(),
          sourceId: c.sourceId || titleToIdMap.get(c.sourceTitle.toLowerCase().trim()) || null,
          targetId: c.targetId || titleToIdMap.get(c.targetTitle.toLowerCase().trim()) || null,
          label: c.label?.trim() || null,
          type: (['builds_on', 'contrasts', 'supports', 'leads_to', 'related'].includes(c.type || '')
            ? c.type
            : 'related') as string,
        }));

      return NextResponse.json({
        ideas: filteredIdeas.map(idea => ({
          title: idea.title.trim(),
          description: idea.description?.trim() || null,
          author: idea.author || 'Unknown',
          sourceSegmentIds: idea.sourceSegmentIds || [],
          ideaType: idea.type === 'category' ? 'category' : idea.type === 'action_item' ? 'action_item' : 'idea',
          parentTitle: idea.parentTitle?.trim() || null,
          parentId: idea.parentId || titleToIdMap.get(idea.parentTitle?.toLowerCase().trim() || '') || null,
        })),
        connections,
        logEntry,
      });
    } catch (error) {
      const logEntry = error instanceof LLMError ? error.logEntry : null;
      console.error('Idea extraction LLM call failed:', error);
      return NextResponse.json({ ideas: [], connections: [], logEntry });
    }
  } catch (error) {
    console.error('Idea extraction endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
