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
    .select('name, description, language')
    .eq('id', projectId)
    .single();
  const isEn = (project?.language ?? 'de') === 'en';

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

  // Build structured data context (bilingual keys)
  const dataContext = (canonicals ?? []).map((cq, idx) => {
    const cqAnswers = (answers ?? [])
      .filter(a => a.canonical_question_id === cq.id)
      .map((a: { ia_interviews: { name: string }; answer_text: string; sentiment: string; word_count: number }) => ({
        interview: a.ia_interviews?.name ?? (isEn ? 'Unknown' : 'Unbekannt'),
        text: a.answer_text,
        sentiment: a.sentiment,
      }));

    const summary = (summaries ?? []).find(s => s.canonical_question_id === cq.id);

    return {
      question: `F${idx + 1}: ${cq.canonical_text}`,
      topic: cq.topic_area || undefined,
      summary: summary?.summary_text || undefined,
      answers: cqAnswers,
    };
  });

  // Truncate context to ~100k chars to avoid token overflow
  let dataString = JSON.stringify(dataContext, null, 1);
  const MAX_CONTEXT_CHARS = 100_000;
  if (dataString.length > MAX_CONTEXT_CHARS) {
    // Summarize: drop individual answers, keep only summaries
    const truncatedContext = (canonicals ?? []).map((cq, idx) => {
      const summary = (summaries ?? []).find(s => s.canonical_question_id === cq.id);
      const answerCount = (answers ?? []).filter(a => a.canonical_question_id === cq.id).length;
      return {
        question: `F${idx + 1}: ${cq.canonical_text}`,
        topic: cq.topic_area || undefined,
        summary: summary?.summary_text || undefined,
        answer_count: answerCount,
      };
    });
    dataString = JSON.stringify(truncatedContext, null, 1);
  }

  // Truncate conversation history to last 20 messages
  const recentMessages = messages.slice(-20);

  const projectLabel = project?.name ?? (isEn ? 'Unknown' : 'Unbekannt');

  const systemPrompt = isEn
    ? `You are a qualitative research assistant. You answer questions based on data from an interview research project.

PROJECT: "${projectLabel}"${project?.description ? `\nDescription: ${project.description}` : ''}
DATA BASIS: ${interviewCount} interviews, ${totalAnswers} segmented answers across ${(canonicals ?? []).length} canonical questions.

DATA:
${dataString}

RULES:
- Answer questions ONLY based on the data above. Do not make things up.
- Always cite the source: [Interview-Name → FX] (e.g., [Anna Müller → F3])
- Report frequencies both absolutely AND relatively (e.g., "7 of 10, 70%")
- For comparisons: structure the answer clearly (Interview A says X, Interview B says Y)
- If the data cannot answer a question, say so honestly
- You may use markdown tables for quantitative overviews
- Be precise and data-driven, no speculative interpretations
- If asked about topics outside the interview data, politely decline
- Respond in English`
    : `Du bist eine qualitative Forschungsassistenz. Du beantwortest Fragen basierend auf den Daten eines Interview-Forschungsprojekts.

PROJEKT: "${projectLabel}"${project?.description ? `\nBeschreibung: ${project.description}` : ''}
DATENBASIS: ${interviewCount} Interviews, ${totalAnswers} segmentierte Antworten auf ${(canonicals ?? []).length} kanonische Fragen.

DATEN:
${dataString}

REGELN:
- Beantworte Fragen NUR basierend auf den obigen Daten. Erfinde nichts dazu.
- Zitiere immer die Quelle: [Interview-Name → FX] (z.B. [Anna Müller → F3])
- Nenne Häufigkeiten absolut UND relativ (z.B. "7 von 10, 70%")
- Bei Vergleichen: Strukturiere die Antwort klar (Interview A sagt X, Interview B sagt Y)
- Wenn die Daten eine Frage nicht beantworten können, sage das ehrlich
- Du darfst Markdown-Tabellen für quantitative Übersichten verwenden
- Sei präzise und datengetrieben, keine spekulativen Interpretationen
- Bei Fragen ausserhalb der Interview-Daten: höflich ablehnen
- Antworte auf Deutsch`;

  const stream = await openai.chat.completions.create({
    model: 'gpt-5.4-mini',
    temperature: 0.3,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...recentMessages
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
