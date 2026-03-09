import { NextRequest, NextResponse } from 'next/server';
import { callLLM, LLMError } from '@/lib/llm/client';
import { requireApiKey, loadRoutingConfig } from '@/lib/api/routeHelpers';

interface ExtractionRequest {
  segments: { id: string; speaker: string; text: string }[];
  contextSegments?: { id: string; speaker: string; text: string }[];
  existingTitles: string[];
  existingIdeas: { id: string; title: string; description?: string | null; ideaType?: string }[];
  language: string;
}

function getSystemPrompt(language: string): string {
  const isGerman = language.startsWith('de');

  if (isGerman) {
    return `Du bist ein Assistent, der Ideen aus Brainstorming-Transkripten extrahiert.

WICHTIGSTE REGEL — QUALITÄTSFILTER:
- Extrahiere NUR echte Brainstorming-Ideen: konkrete Vorschläge, Konzepte, Lösungsansätze.
- Wenn das Transkript KEINE echten Ideen enthält (z.B. Smalltalk, Gesang, Begrüßung, Unsinn), gib leere Arrays zurück: {"ideas": [], "connections": []}.
- Eine Idee ist ein konkreter Vorschlag oder Konzept — NICHT ein einzelnes Wort, ein Verb, oder ein Satzfragment ohne Substanz.
- Erfinde KEINE Ideen. Extrahiere nur was WIRKLICH gesagt wurde.
- Titel sollen nah am Original bleiben. Beschreibungen fassen nur zusammen was gesagt wurde.

EXTRAKTION:
- Wenn jemand mehrere Alternativen oder Unterideen vorstellt, ist JEDE Alternative eine eigene Idee (z.B. "entweder X oder Y" = 2 Ideen).
- Fasse zusammenhängende Aussagen zu EINER Idee zusammen, aber trenne echte Alternativen.
- Jede Idee braucht einen kurzen Titel (2-6 Wörter) und eine optionale Kurzbeschreibung (1 Satz).
- Ordne jede Idee dem Sprecher zu.
- Extrahiere KEINE Ideen, die den vorhandenen Titeln entsprechen (Deduplizierung).

VERBINDUNGEN:
- Verbindungstypen: "builds_on", "contrasts", "supports", "leads_to", "related".
- Verwende "sourceTitle" und "targetTitle" für die Zuordnung. Erfinde KEINE IDs — setze sourceId/targetId nur wenn du eine echte bestehende ID hast.
- Erstelle Connections wenn Ideen inhaltlich zusammenhängen: Unterpunkte desselben Themas = "related", Alternativen = "contrasts", Erweiterungen = "builds_on".
- Cross-Speaker: Wenn ein Sprecher auf eine andere Idee Bezug nimmt, erstelle eine Connection.

KATEGORIEN:
- Wenn ein Sprecher ein übergeordnetes Thema benennt und Unterpunkte aufzählt (z.B. "drei Punkte: erstens X, zweitens Y"), ist das Thema eine Idee mit type "category". Unterpunkte referenzieren "parentTitle".

Antworte auf Deutsch. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt:
{"ideas": [{"title": "Kurzer Titel", "description": "Was gesagt wurde", "author": "Sprechername", "sourceSegmentIds": ["seg-id"], "type": "idea", "parentTitle": null, "parentId": null}], "connections": [{"sourceTitle": "A", "targetTitle": "B", "sourceId": null, "targetId": null, "label": "kurze Beschreibung", "type": "related"}]}`;
  }

  return `You are an assistant that extracts ideas from brainstorming transcripts.

MOST IMPORTANT RULE — QUALITY FILTER:
- Extract ONLY real brainstorming ideas: concrete proposals, concepts, solution approaches.
- If the transcript contains NO real ideas (e.g. small talk, singing, greetings, nonsense), return empty arrays: {"ideas": [], "connections": []}.
- An idea is a concrete proposal or concept — NOT a single word, a verb, or a fragment without substance.
- Do NOT invent ideas. Only extract what was ACTUALLY said.
- Titles should stay close to the original words. Descriptions summarize only what was said.

EXTRACTION:
- When someone presents multiple alternatives or sub-ideas, each alternative is its OWN idea (e.g. "either X or Y" = 2 ideas).
- Merge related statements into ONE idea, but separate real alternatives.
- Each idea needs a short title (2-6 words) and an optional 1-sentence description.
- Attribute each idea to the speaker.
- Do NOT extract ideas matching existing titles (deduplication).

CONNECTIONS:
- Connection types: "builds_on", "contrasts", "supports", "leads_to", "related".
- Use "sourceTitle" and "targetTitle" for matching. Do NOT invent IDs — only set sourceId/targetId if you have a real existing ID.
- Create connections when ideas are thematically related: sub-points of the same topic = "related", alternatives = "contrasts", extensions = "builds_on".
- Cross-speaker: When a speaker references another's idea, create a connection.

CATEGORIES:
- When a speaker names an overarching topic and lists sub-points (e.g. "three things: first X, second Y"), the topic is an idea with type "category". Sub-points reference "parentTitle".

Respond in English. Respond ONLY with a JSON object:
{"ideas": [{"title": "Short Title", "description": "What was said", "author": "Speaker Name", "sourceSegmentIds": ["seg-id"], "type": "idea", "parentTitle": null, "parentId": null}], "connections": [{"sourceTitle": "A", "targetTitle": "B", "sourceId": null, "targetId": null, "label": "short description", "type": "related"}]}`;
}

export async function POST(request: NextRequest) {
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
          ideaType: idea.type === 'category' ? 'category' : 'idea',
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
