import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { canonicalQuestionId } = body;

  if (!canonicalQuestionId) {
    return NextResponse.json({ error: 'canonicalQuestionId is required' }, { status: 400 });
  }

  const sb = getServiceClient();
  const openai = getOpenAIClient();

  // Load canonical question
  const { data: cq } = await sb
    .from('ia_canonical_questions')
    .select('*')
    .eq('id', canonicalQuestionId)
    .eq('project_id', projectId)
    .single();

  if (!cq) {
    return NextResponse.json({ error: 'Canonical question not found' }, { status: 404 });
  }

  // Load all answers for this question with interview names
  const { data: answers } = await sb
    .from('ia_answers')
    .select('*, ia_interviews(name)')
    .eq('canonical_question_id', canonicalQuestionId);

  if (!answers?.length) {
    return NextResponse.json({ error: 'No answers for this question' }, { status: 400 });
  }

  // Load total interview count
  const { count } = await sb
    .from('ia_interviews')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .in('status', ['transcribed', 'analyzed']);

  const answerSummaries = answers.map((a: { ia_interviews: { name: string }; answer_text: string; sentiment: string; word_count: number }) => ({
    interview: a.ia_interviews?.name,
    text: a.answer_text,
    sentiment: a.sentiment,
    word_count: a.word_count,
  }));

  // Pre-compute sentiment distribution for the prompt
  const sentimentCounts: Record<string, number> = {};
  for (const a of answers) {
    const s = a.sentiment || 'neutral';
    sentimentCounts[s] = (sentimentCounts[s] || 0) + 1;
  }
  const sentimentLine = Object.entries(sentimentCounts)
    .map(([s, c]) => `${s}: ${c}`)
    .join(', ');

  const topicContext = cq.topic_area ? `\nThemengebiet: "${cq.topic_area}"` : '';
  const coverageGap = (count ?? 0) - answers.length;
  const coverageNote = coverageGap > 0
    ? `\n\nHINWEIS: ${coverageGap} von ${count} Befragten haben diese Frage NICHT beantwortet. Erwähne diese Lücke in der Zusammenfassung, falls relevant.`
    : '';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `Du bist ein qualitativ-forschender Analyst. Erstelle eine prägnante Zusammenfassung aller Antworten auf eine Interview-Frage.

Die Zusammenfassung soll:
- 3-5 Sätze lang sein
- Die Häufigkeitsverteilung der Meinungen/Themen nennen (absolut UND relativ, z.B. "12 von 25, 48%")
- Die Sentiment-Verteilung der Antworten berücksichtigen (positive/negative/neutral/ambivalent)
- Dominante Muster hervorheben
- Auffällige Ausreisser oder Abweichungen erwähnen
- Wenn ein signifikanter Anteil der Befragten die Frage nicht beantwortet hat, dies erwähnen
- Keine eigenen Interpretationen hinzufügen, nur beschreiben was in den Daten steht

Schreibe auf Deutsch.`
      },
      {
        role: 'user',
        content: `Frage: "${cq.canonical_text}"${topicContext}

${answers.length} von ${count ?? answers.length} Befragten haben diese Frage beantwortet.
Sentiment-Verteilung: ${sentimentLine}${coverageNote}

Antworten:
${JSON.stringify(answerSummaries, null, 2)}`
      }
    ],
  });

  const summaryText = response.choices[0]?.message?.content;
  if (!summaryText) {
    return NextResponse.json({ error: 'No summary generated' }, { status: 500 });
  }

  // Upsert summary (atomic to prevent race conditions)
  await sb
    .from('ia_question_summaries')
    .upsert(
      { canonical_question_id: canonicalQuestionId, summary_text: summaryText, generated_at: new Date().toISOString() },
      { onConflict: 'canonical_question_id' }
    );

  return NextResponse.json({ summary: summaryText });
}
