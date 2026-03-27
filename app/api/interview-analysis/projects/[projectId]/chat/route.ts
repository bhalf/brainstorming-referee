import { NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { messages } = body as { messages: Array<{ role: 'user' | 'assistant'; content: string }> };

  if (!messages?.length) {
    return new Response(JSON.stringify({ error: 'No messages provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sb = getServiceClient();
  const openai = getOpenAIClient();

  // Load project metadata
  const { data: project } = await sb
    .from('ia_projects')
    .select('name, description')
    .eq('id', projectId)
    .single();

  // Load all canonical questions + answers + summaries for context
  const { data: canonicals } = await sb
    .from('ia_canonical_questions')
    .select('id, canonical_text, topic_area, sort_order')
    .eq('project_id', projectId)
    .order('sort_order');

  const canonicalIds = (canonicals ?? []).map(c => c.id);

  const [{ data: answers }, { data: summaries }, { data: interviews }] = canonicalIds.length > 0
    ? await Promise.all([
        sb.from('ia_answers').select('*, ia_interviews(name)').in('canonical_question_id', canonicalIds),
        sb.from('ia_question_summaries').select('*').in('canonical_question_id', canonicalIds),
        sb.from('ia_interviews').select('id, name').eq('project_id', projectId).in('status', ['transcribed', 'analyzed']),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const interviewCount = (interviews ?? []).length;
  const totalAnswers = (answers ?? []).length;

  // Build structured data context
  const dataContext = (canonicals ?? []).map((cq, idx) => {
    const cqAnswers = (answers ?? [])
      .filter(a => a.canonical_question_id === cq.id)
      .map((a: { ia_interviews: { name: string }; answer_text: string; sentiment: string; word_count: number }) => ({
        interview: a.ia_interviews?.name ?? 'Unbekannt',
        text: a.answer_text,
        sentiment: a.sentiment,
      }));

    const summary = (summaries ?? []).find(s => s.canonical_question_id === cq.id);

    return {
      frage: `F${idx + 1}: ${cq.canonical_text}`,
      thema: cq.topic_area || undefined,
      zusammenfassung: summary?.summary_text || undefined,
      antworten: cqAnswers,
    };
  });

  const systemPrompt = `Du bist eine qualitative Forschungsassistenz. Du beantwortest Fragen basierend auf den Daten eines Interview-Forschungsprojekts.

PROJEKT: "${project?.name ?? 'Unbekannt'}"${project?.description ? `\nBeschreibung: ${project.description}` : ''}
DATENBASIS: ${interviewCount} Interviews, ${totalAnswers} segmentierte Antworten auf ${(canonicals ?? []).length} kanonische Fragen.

DATEN:
${JSON.stringify(dataContext, null, 1)}

REGELN:
- Beantworte Fragen NUR basierend auf den obigen Daten. Erfinde nichts dazu.
- Zitiere immer die Quelle: [Interview-Name → FX] (z.B. [Anna Müller → F3])
- Nenne Häufigkeiten absolut UND relativ (z.B. "7 von 10, 70%")
- Bei Vergleichen: Strukturiere die Antwort klar (Interview A sagt X, Interview B sagt Y)
- Wenn die Daten eine Frage nicht beantworten können, sage das ehrlich
- Antworte auf Deutsch
- Sei präzise und datengetrieben, keine spekulativen Interpretationen`;

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
  });

  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(encoder.encode(`\n\n[Fehler: ${errorMsg}]`));
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    }
  );
}
