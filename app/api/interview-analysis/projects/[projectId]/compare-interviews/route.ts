import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';

export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { interviewAId, interviewBId, force } = body;

  if (!interviewAId || !interviewBId) {
    return NextResponse.json({ error: 'interviewAId and interviewBId are required' }, { status: 400 });
  }

  // Normalize order for cache key
  const [idA, idB] = interviewAId < interviewBId
    ? [interviewAId, interviewBId]
    : [interviewBId, interviewAId];

  const sb = getServiceClient();
  const openai = getOpenAIClient();

  // Load project
  const { data: project } = await sb
    .from('ia_projects')
    .select('name, description, language')
    .eq('id', projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const isEn = project.language === 'en';

  // Check cache (< 24h and not forced)
  if (!force) {
    const { data: cached } = await sb
      .from('ia_comparison_summaries')
      .select('summary_json, summary_json_alt, generated_at')
      .eq('interview_a_id', idA)
      .eq('interview_b_id', idB)
      .single();

    if (cached) {
      const age = Date.now() - new Date(cached.generated_at).getTime();
      if (age < 24 * 60 * 60 * 1000) {
        return NextResponse.json({
          summary: cached.summary_json,
          summary_alt: cached.summary_json_alt,
          cached: true,
        });
      }
    }
  }

  // Load interviews
  const { data: interviewsRaw } = await sb
    .from('ia_interviews')
    .select('id, name, word_count')
    .in('id', [idA, idB]);

  if (!interviewsRaw || interviewsRaw.length < 2) {
    return NextResponse.json({ error: 'Interviews not found' }, { status: 404 });
  }

  const interviewA = interviewsRaw.find(i => i.id === idA)!;
  const interviewB = interviewsRaw.find(i => i.id === idB)!;

  // Load canonical questions + answers for both interviews
  const { data: canonicals } = await sb
    .from('ia_canonical_questions')
    .select('id, canonical_text, topic_area, sort_order')
    .eq('project_id', projectId)
    .order('sort_order');

  if (!canonicals || canonicals.length === 0) {
    return NextResponse.json({ error: 'No canonical questions found' }, { status: 400 });
  }

  const { data: answers } = await sb
    .from('ia_answers')
    .select('canonical_question_id, interview_id, answer_text, word_count, sentiment, follow_ups')
    .in('interview_id', [idA, idB]);

  // Build per-question comparison data
  type AnswerRow = NonNullable<typeof answers>[number];
  const answerMap = new Map<string, Map<string, AnswerRow>>();
  for (const a of (answers ?? [])) {
    if (!answerMap.has(a.canonical_question_id)) answerMap.set(a.canonical_question_id, new Map<string, AnswerRow>());
    answerMap.get(a.canonical_question_id)!.set(a.interview_id, a);
  }

  // Aggregate stats
  function buildStats(interviewId: string, name: string, wordCount: number | null) {
    const sentiments: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
    let answered = 0;
    for (const cq of canonicals!) {
      const a = answerMap.get(cq.id)?.get(interviewId);
      if (a) {
        answered++;
        sentiments[a.sentiment ?? 'neutral']++;
      }
    }
    return {
      name,
      total_words: wordCount ?? 0,
      coverage_pct: Math.round((answered / canonicals!.length) * 100),
      sentiment_distribution: sentiments,
    };
  }

  const statsA = buildStats(idA, interviewA.name, interviewA.word_count);
  const statsB = buildStats(idB, interviewB.name, interviewB.word_count);

  // Build context for LLM
  const questionsContext = canonicals.map((cq, idx) => {
    const aAnswer = answerMap.get(cq.id)?.get(idA);
    const bAnswer = answerMap.get(cq.id)?.get(idB);
    return {
      id: `F${idx + 1}`,
      text: cq.canonical_text,
      topic: cq.topic_area,
      interview_a: aAnswer ? {
        answer: aAnswer.answer_text,
        sentiment: aAnswer.sentiment,
        word_count: aAnswer.word_count,
      } : null,
      interview_b: bAnswer ? {
        answer: bAnswer.answer_text,
        sentiment: bAnswer.sentiment,
        word_count: bAnswer.word_count,
      } : null,
    };
  });

  const context = JSON.stringify({
    project: { name: project.name, description: project.description },
    questions: questionsContext,
    stats: { interview_a: statsA, interview_b: statsB },
  });

  const systemPromptDe = `Du bist ein erfahrener qualitativer Forschungsanalyst. Vergleiche zwei Interviews aus demselben Forschungsprojekt.

Erstelle eine strukturierte JSON-Analyse:
{
  "key_differences": [{ "topic": "Themenbereich", "description": "Beschreibung des Unterschieds", "interview_a_stance": "Position/Aussage von ${interviewA.name}", "interview_b_stance": "Position/Aussage von ${interviewB.name}" }],
  "similarities": [{ "topic": "Themenbereich", "description": "Beschreibung der Gemeinsamkeit" }],
  "notable_patterns": ["Auffälliges Muster 1", ...],
  "overall_summary": "Gesamtzusammenfassung in 3-5 Sätzen"
}

Regeln:
- Basiere deine Analyse NUR auf den bereitgestellten Daten
- Zitiere konkrete Aussagen und nenne die Frage-Nummer (z.B. F3)
- Fokussiere auf inhaltliche Unterschiede, nicht triviale Formulierungsunterschiede
- Nenne bei "notable_patterns" unerwartete Befunde (z.B. ein Interview deutlich ausführlicher, Stimmungswechsel bei bestimmten Themen, ein Interview vermeidet bestimmte Themen)
- "overall_summary" sollte 3-5 Sätze lang sein
- Nenne absolute Zahlen wo möglich
- Liefere 3-7 key_differences, 2-5 similarities und 2-4 notable_patterns
- Wenn ein Interview eine Frage beantwortet hat und das andere nicht, ist das ein key_difference — erwähne es explizit
- Mit nur 2 Interviews: Identifiziere Kontraste, formuliere keine allgemeinen "Muster" oder Trends
- Antworte auf Deutsch`;

  const systemPromptEn = `You are an experienced qualitative research analyst. Compare two interviews from the same research project.

Produce a structured JSON analysis:
{
  "key_differences": [{ "topic": "Topic area", "description": "Description of difference", "interview_a_stance": "Position/statement from ${interviewA.name}", "interview_b_stance": "Position/statement from ${interviewB.name}" }],
  "similarities": [{ "topic": "Topic area", "description": "Description of similarity" }],
  "notable_patterns": ["Notable pattern 1", ...],
  "overall_summary": "Overall summary in 3-5 sentences"
}

Rules:
- Base your analysis ONLY on the provided data
- Cite specific statements and reference question numbers (e.g., F3)
- Focus on substantive differences, not trivial wording differences
- For "notable_patterns", highlight unexpected findings (e.g., one interview much more detailed, sentiment shifts on specific topics, one avoids certain topics)
- Keep "overall_summary" to 3-5 sentences
- Include absolute numbers where possible
- Return 3-7 key_differences, 2-5 similarities, and 2-4 notable_patterns
- If one interview answered a question but the other did not, that is a key_difference — mention it explicitly
- With only 2 interviews: identify contrasts, do not claim general "patterns" or trends
- Respond in English`;

  const primaryPrompt = isEn ? systemPromptEn : systemPromptDe;
  const altPrompt = isEn ? systemPromptDe : systemPromptEn;

  try {
    const [primaryRes, altRes] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-5.4',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: primaryPrompt },
          { role: 'user', content: context },
        ],
      }),
      openai.chat.completions.create({
        model: 'gpt-5.4',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: altPrompt },
          { role: 'user', content: context },
        ],
      }).catch(() => null),
    ]);

    const primaryContent = primaryRes.choices[0]?.message?.content;
    if (!primaryContent) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }
    const primaryJson = JSON.parse(primaryContent);
    if (!primaryJson.overall_summary && !primaryJson.key_differences) {
      return NextResponse.json({ error: 'AI response missing expected fields (overall_summary, key_differences)' }, { status: 500 });
    }
    const altJson = altRes ? JSON.parse(altRes.choices[0]?.message?.content ?? '{}') : null;

    // Upsert cache
    await sb
      .from('ia_comparison_summaries')
      .upsert({
        project_id: projectId,
        interview_a_id: idA,
        interview_b_id: idB,
        summary_json: primaryJson,
        summary_json_alt: altJson,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'interview_a_id,interview_b_id' });

    return NextResponse.json({
      summary: primaryJson,
      summary_alt: altJson,
      cached: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `AI comparison failed: ${message}` }, { status: 500 });
  }
}
