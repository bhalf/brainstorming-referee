import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';

interface ExtractionRequest {
  segments: { id: string; speaker: string; text: string }[];
  existingTitles: string[];
  existingIdeas: { id: string; title: string; description?: string | null; ideaType?: string }[];
  language: string;
}

function getSystemPrompt(language: string): string {
  const isGerman = language.startsWith('de');

  if (isGerman) {
    return `Du bist ein Assistent, der Ideen aus Brainstorming-Transkripten extrahiert.

WICHTIGSTE REGEL — KEINE HALLUZINATION:
- Extrahiere NUR Ideen, die WÖRTLICH im Transkript erwähnt werden.
- Erfinde NIEMALS neue Ideen, die nicht im Transkript stehen.
- Interpretiere oder erweitere KEINE Ideen. Wenn jemand sagt "die Leute stehen im Wald rum", ist die Idee "Leute stehen im Wald", NICHT "Wald-Erlebnisräume" oder "Waldpädagogik".
- Titel sollen möglichst nah an den Originalworten des Sprechers bleiben.
- Beschreibungen sollen nur zusammenfassen, was gesagt wurde — nichts hinzufügen.

REGELN:
1. Jede Idee braucht einen kurzen Titel (2-6 Wörter, nah am Original) und eine optionale Kurzbeschreibung (1 Satz, was der Sprecher gesagt hat).
2. Ordne jede Idee dem Sprecher zu, der sie gesagt hat.
3. Extrahiere KEINE Ideen, die den vorhandenen Titeln entsprechen (Deduplizierung).
4. Nur echte inhaltliche Ideen — keine Begrüßungen, Prozesskommentare oder Metadiskussionen.
5. Verbindungen zwischen Ideen: "builds_on", "contrasts", "supports", "leads_to", "related".
6. Bei Connections verwende die ID bestehender Ideen in "targetId"/"sourceId".
7. Kategorien: NUR wenn ein Sprecher EXPLIZIT ein übergeordnetes Thema benennt (z.B. "Ich habe Ideen für eine Baumschule"), erstelle eine Idee mit type "category". Kinder-Ideen referenzieren dann "parentTitle" oder "parentId".
8. Antworte auf Deutsch.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt:
{"ideas": [{"title": "Kurzer Titel", "description": "Was gesagt wurde", "author": "Sprechername", "sourceSegmentIds": ["seg-id"], "type": "idea", "parentTitle": null, "parentId": null}], "connections": [{"sourceTitle": "A", "targetTitle": "B", "sourceId": null, "targetId": null, "label": "kurze Beschreibung", "type": "related"}]}`;
  }

  return `You are an assistant that extracts ideas from brainstorming transcripts.

MOST IMPORTANT RULE — NO HALLUCINATION:
- Extract ONLY ideas that are EXPLICITLY mentioned in the transcript.
- NEVER invent new ideas that are not in the transcript.
- Do NOT interpret or expand ideas. If someone says "people stand around in the forest", the idea is "People stand in forest", NOT "Forest experience spaces" or "Nature-based learning".
- Titles should stay as close as possible to the speaker's original words.
- Descriptions should only summarize what was said — add nothing new.

RULES:
1. Each idea needs a short title (2-6 words, close to original) and an optional 1-sentence description (what the speaker said).
2. Attribute each idea to the speaker who said it.
3. Do NOT extract ideas matching existing titles (deduplication).
4. Only real substantive ideas — no greetings, process comments, or meta-discussion.
5. Connections between ideas: "builds_on", "contrasts", "supports", "leads_to", "related".
6. For connections, use the ID of existing ideas in "targetId"/"sourceId".
7. Categories: ONLY when a speaker EXPLICITLY names a higher-level topic (e.g. "I have ideas for a tree nursery"), create an idea with type "category". Child ideas should reference "parentTitle" or "parentId".
8. Respond in English.

Respond ONLY with a JSON object:
{"ideas": [{"title": "Short Title", "description": "What was said", "author": "Speaker Name", "sourceSegmentIds": ["seg-id"], "type": "idea", "parentTitle": null, "parentId": null}], "connections": [{"sourceTitle": "A", "targetTitle": "B", "sourceId": null, "targetId": null, "label": "short description", "type": "related"}]}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExtractionRequest;
    const { segments, existingTitles = [], existingIdeas = [], language = 'en-US' } = body;

    if (!segments || segments.length === 0) {
      return NextResponse.json({ ideas: [], connections: [], logEntry: null });
    }

    const apiKeyResult = requireApiKey();
    if ('error' in apiKeyResult) return apiKeyResult.error;
    const apiKey = apiKeyResult.key;

    const routingConfig = loadRoutingConfig();

    const transcriptText = segments
      .map(s => `[${s.speaker}] (id: ${s.id}): ${s.text}`)
      .join('\n');

    const existingList = existingIdeas.length > 0
      ? `Existing ideas (do NOT repeat these, but you CAN create connections TO them using their ID):\n${existingIdeas.map(ei => `- [ID: ${ei.id}] "${ei.title}"${ei.description ? ` — ${ei.description}` : ''}${ei.ideaType === 'category' ? ' (CATEGORY)' : ''}`).join('\n')}`
      : 'No existing ideas yet.';

    const userPrompt = `${existingList}

Recent transcript segments:
${transcriptText}`;

    try {
      const { text, logEntry } = await callLLM(
        'idea_extraction',
        routingConfig,
        [
          { role: 'system', content: getSystemPrompt(language) },
          { role: 'user', content: userPrompt },
        ],
        apiKey,
        { responseFormat: { type: 'json_object' } }
      );

      let parsed: {
        ideas: Array<{ title: string; description?: string; author: string; sourceSegmentIds?: string[]; type?: 'idea' | 'category'; parentTitle?: string | null; parentId?: string | null }>;
        connections?: Array<{ sourceTitle: string; targetTitle: string; sourceId?: string | null; targetId?: string | null; label?: string; type?: string }>;
      };
      try {
        parsed = JSON.parse(text);
      } catch {
        console.error('Failed to parse idea extraction response:', text);
        return NextResponse.json({ ideas: [], connections: [], logEntry });
      }

      if (!parsed.ideas || !Array.isArray(parsed.ideas)) {
        return NextResponse.json({ ideas: [], connections: [], logEntry });
      }

      // Filter out ideas that match existing titles (case-insensitive fuzzy dedup)
      const existingLower = existingTitles.map(t => t.toLowerCase().trim());
      const filteredIdeas = parsed.ideas.filter(idea => {
        if (!idea.title || idea.title.trim().length === 0) return false;
        const titleLower = idea.title.toLowerCase().trim();
        return !existingLower.some(existing =>
          existing === titleLower || existing.includes(titleLower) || titleLower.includes(existing)
        );
      });

      // Build title→id map for resolving connections
      const allTitles = new Map<string, string>();
      for (const ei of existingIdeas) {
        allTitles.set(ei.title.toLowerCase().trim(), ei.id);
      }
      // New ideas will get IDs assigned by the client, so we return them by title

      // Process connections — pass through IDs if the LLM provided them
      const connections = (parsed.connections || [])
        .filter(c => c.sourceTitle && c.targetTitle && c.sourceTitle !== c.targetTitle)
        .map(c => ({
          sourceTitle: c.sourceTitle.trim(),
          targetTitle: c.targetTitle.trim(),
          sourceId: c.sourceId || null,
          targetId: c.targetId || null,
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
          ideaType: idea.type === 'category' ? 'category' : 'idea',
          parentTitle: idea.parentTitle?.trim() || null,
          parentId: idea.parentId || null,
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
