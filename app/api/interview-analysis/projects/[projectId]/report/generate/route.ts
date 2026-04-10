import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';

export const maxDuration = 120;

/**
 * POST: Generate AI-verified scientific analysis for one canonical question.
 *
 * SCIENTIFIC GUARANTEES:
 * - Quotes are verified server-side against actual answer texts
 * - Unverified quotes are flagged
 * - Frequencies are pre-computed and injected, not left to the model
 * - The model receives ALL answers, no sampling
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { canonicalQuestionId } = body;

  if (!canonicalQuestionId) {
    return NextResponse.json({ error: 'canonicalQuestionId required' }, { status: 400 });
  }

  const sb = getServiceClient();
  const openai = getOpenAIClient();

  const { data: project } = await sb
    .from('ia_projects')
    .select('language')
    .eq('id', projectId)
    .single();
  const isEn = (project?.language ?? 'de') === 'en';

  const { data: cq } = await sb
    .from('ia_canonical_questions')
    .select('*')
    .eq('id', canonicalQuestionId)
    .single();

  if (!cq) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  const { data: answers } = await sb
    .from('ia_answers')
    .select('*, ia_interviews(name, group_label)')
    .eq('canonical_question_id', canonicalQuestionId);

  if (!answers?.length) {
    return NextResponse.json({ error: 'No answers' }, { status: 400 });
  }

  // Total number of analyzed interviews in the project
  const { count: totalInterviews } = await sb
    .from('ia_interviews')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .in('status', ['transcribed', 'analyzed']);

  const N = totalInterviews ?? answers.length;
  const n = answers.length;

  // Build answer data — each answer gets a stable ID tied to participant name
  const answerData = answers.map((a: {
    ia_interviews: { name: string; group_label: string | null };
    answer_text: string;
    sentiment: string;
    confidence: string;
    match_type: string;
    word_count: number;
  }, idx: number) => ({
    id: `A${idx + 1}`,
    participant: a.ia_interviews?.name ?? `T${idx + 1}`,
    group: a.ia_interviews?.group_label ?? null,
    text: a.answer_text,
    sentiment: a.sentiment,
    confidence: a.confidence,
    match_type: a.match_type,
    word_count: a.word_count,
  }));

  // Pre-compute sentiment distribution
  const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
  for (const a of answers) sentimentCounts[a.sentiment || 'neutral']++;
  const sentimentLine = Object.entries(sentimentCounts)
    .filter(([, c]) => c > 0)
    .map(([s, c]) => `${s}: ${c}/${n}`)
    .join(', ');

  const systemPrompt = isEn
    ? buildEnglishPrompt(N, n)
    : buildGermanPrompt(N, n);

  const userContent = [
    `${isEn ? 'Question' : 'Frage'}: "${cq.canonical_text}"`,
    cq.topic_area ? `Topic: ${cq.topic_area}` : '',
    '',
    `${isEn ? 'IMPORTANT NUMBERS' : 'WICHTIGE ZAHLEN'}:`,
    `- ${isEn ? 'Total interviews in project' : 'Interviews im Projekt gesamt'}: ${N}`,
    `- ${isEn ? 'Answered this question' : 'Haben diese Frage beantwortet'}: ${n}/${N}`,
    n < N ? `- ${isEn ? 'Did NOT answer' : 'Haben NICHT geantwortet'}: ${N - n}/${N}` : '',
    `- Sentiment: ${sentimentLine}`,
    '',
    `${isEn ? 'All' : 'Alle'} ${n} ${isEn ? 'answers' : 'Antworten'}:`,
    JSON.stringify(answerData, null, 2),
  ].filter(Boolean).join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.4',
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Empty AI response' }, { status: 500 });
    }

    const analysis = JSON.parse(content);

    // ── SERVER-SIDE QUOTE VERIFICATION ──────────────────────────────────
    // Check each quote against the actual answer texts
    const validatedQuotes = (analysis.selected_quotes ?? []).map((q: {
      answer_id: string;
      participant: string;
      quote: string;
      relevance: string;
    }) => {
      // Find the answer this quote claims to be from
      const sourceAnswer = answerData.find(a => a.id === q.answer_id);
      let verified = false;
      let sourceText = '';

      if (sourceAnswer) {
        sourceText = sourceAnswer.text;
        // Strip [...] markers for comparison
        const cleanQuote = q.quote.replace(/\s*\[\.{3}\]\s*/g, '|||SPLIT|||');
        const parts = cleanQuote.split('|||SPLIT|||').filter(p => p.trim().length > 10);

        if (parts.length > 0) {
          // Every substantial part of the quote must appear in the source answer
          verified = parts.every(part => sourceText.includes(part.trim()));
        } else {
          // Short quote — check directly
          verified = sourceText.includes(q.quote.trim());
        }
      }

      // Also try matching against ALL answers (in case answer_id is wrong)
      if (!verified) {
        for (const a of answerData) {
          if (a.text.includes(q.quote.replace(/\s*\[\.{3}\]\s*/g, ' ').trim())) {
            verified = true;
            break;
          }
        }
      }

      return { ...q, verified };
    });

    return NextResponse.json({
      canonical_question_id: canonicalQuestionId,
      question_text: cq.canonical_text,
      summary: analysis.summary,
      notable_patterns: analysis.notable_patterns,
      selected_quotes: validatedQuotes,
      quality_notes: analysis.quality_notes ?? null,
      answer_count: n,
      total_interviews: N,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── PROMPTS ──────────────────────────────────────────────────────────────────

function buildEnglishPrompt(N: number, n: number): string {
  return `You are a senior qualitative research analyst writing a publication-ready scientific interview report.

You receive one interview question and ALL ${n} verbatim participant answers (from ${N} total interviews).

═══ FREQUENCY & NUMBER RULES (CRITICAL) ═══

- ALWAYS refer to participants as "X of the participants" or "X participants" — NEVER "X of ${n}" or "X of ${N}".
  GOOD: "3 of the participants reported..."
  GOOD: "The majority of participants (8) described..."
  GOOD: "One participant noted..."
  BAD: "3 of ${n} participants..."
  BAD: "3 of 27 respondents..."
- You may add percentages in parentheses: "Most participants (8, ~73%) agreed..."
- Use natural language for frequencies: "almost all", "the majority", "about half", "several", "a few", "one participant"
- ${n < N ? `Note: ${N - n} of ${N} interviewed participants did NOT answer this question. Mention this if relevant, phrased as "Not all participants addressed this question."` : 'All interviewed participants answered this question.'}

═══ QUOTING RULES (CRITICAL) ═══

- The "quote" field must be VERBATIM from the provided answer text — character for character.
- Include grammar errors, filler words ("like", "uh"), incomplete sentences exactly as they appear.
- Do NOT clean up, paraphrase, combine, or improve quotes.
- You may truncate long quotes with "[...]" but included parts must be EXACT.
- Select quotes that are MEANINGFUL and REPRESENTATIVE — the most insightful, articulate, or revealing passages.
- Prefer quotes that contain a clear position, reasoning, or experience — not generic/vague statements.
- Each quote must come from a DIFFERENT participant.

═══ QUOTE SELECTION STRATEGY (select 3-5) ═══

Pick the most AUSSAGEKRÄFTIGE (meaningful/expressive) quotes:
1. The single most insightful or well-articulated answer that captures the core theme
2. A quote representing a contrasting or minority view (if one exists)
3. A quote showing nuance, ambivalence, or a unique angle
4-5. Additional quotes only if they add genuinely new perspectives not covered by 1-3

Quality over quantity — 3 excellent quotes are better than 5 mediocre ones.

═══ ANALYSIS QUALITY ═══

- Structure summary as: (1) Overall tendency, (2) Consensus points, (3) Differences, (4) Nuances
- Use hedging language: "tended to", "several reported", "one participant noted"
- Note the STRENGTH of positions: "strongly positive" vs "mildly positive"
- notable_patterns must NOT repeat the summary — focus on surprising findings, contradictions, or unexpected connections
- Flag sentiment misclassifications in quality_notes

═══ SELF-CHECK (do this before returning) ═══
1. Recount all frequency claims — are they correct?
2. Verify each quote appears VERBATIM in the provided answers
3. Check that you used "X of the participants" NOT "X of ${n}" or "X of ${N}"
4. Are the selected quotes truly the most meaningful ones?

═══ OUTPUT ═══

Return JSON:
{
  "summary": "4-6 sentences following the structure above",
  "notable_patterns": "2-3 sentences — surprising findings only, no repetition from summary",
  "selected_quotes": [
    {
      "answer_id": "A1",
      "participant": "Name",
      "quote": "EXACT verbatim text from the answer",
      "relevance": "Why this quote: represents majority / strongest dissent / unique insight / shows nuance"
    }
  ],
  "quality_notes": "Sentiment misclassifications, off-topic answers, or data issues. null if none."
}`;
}

function buildGermanPrompt(N: number, n: number): string {
  return `Du bist ein erfahrener qualitativer Forschungsanalyst und schreibst einen publikationsreifen wissenschaftlichen Interview-Bericht.

Du erhältst eine Interviewfrage und ALLE ${n} wörtlichen Teilnehmerantworten (von ${N} Interviews insgesamt).

═══ HÄUFIGKEITS- & ZAHLENREGELN (KRITISCH) ═══

- Verwende IMMER "X der Befragten" oder "X Teilnehmende" — NIEMALS "X von ${n}" oder "X von ${N}".
  GUT: "3 der Befragten berichteten..."
  GUT: "Die Mehrheit der Teilnehmenden (8) beschrieb..."
  GUT: "Eine Person merkte an..."
  SCHLECHT: "3 von ${n} Teilnehmenden..."
  SCHLECHT: "3 von 27 Befragten..."
- Prozentangaben in Klammern erlaubt: "Die meisten Befragten (8, ~73%) stimmten zu..."
- Verwende natürliche Sprache: "fast alle", "die Mehrheit", "etwa die Hälfte", "einige", "wenige", "eine Person"
- ${n < N ? `Hinweis: ${N - n} von ${N} interviewten Personen haben diese Frage NICHT beantwortet. Erwähne dies falls relevant, formuliert als "Nicht alle Befragten äusserten sich zu dieser Frage."` : 'Alle interviewten Personen haben diese Frage beantwortet.'}

═══ ZITIERREGELN (KRITISCH) ═══

- Das "quote"-Feld muss WÖRTLICH aus dem bereitgestellten Antworttext stammen — Zeichen für Zeichen.
- Grammatikfehler, Füllwörter ("also", "ähm"), unvollständige Sätze genau so übernehmen.
- NICHT bereinigen, paraphrasieren, zusammenführen oder verbessern.
- Lange Zitate dürfen mit "[...]" gekürzt werden, aber die enthaltenen Teile müssen EXAKT sein.
- Wähle Zitate die AUSSAGEKRÄFTIG und REPRÄSENTATIV sind — die aufschlussreichsten, artikuliertesten oder aufschlussreichsten Passagen.
- Bevorzuge Zitate mit klarer Position, Begründung oder Erfahrung — nicht generische/vage Aussagen.
- Jedes Zitat muss von einer ANDEREN Person stammen.

═══ ZITAT-AUSWAHL-STRATEGIE (3-5 wählen) ═══

Wähle die AUSSAGEKRÄFTIGSTEN Zitate:
1. Die einzelne aufschlussreichste oder am besten artikulierte Antwort, die das Kernthema einfängt
2. Ein Zitat einer Gegen- oder Minderheitsmeinung (falls vorhanden)
3. Ein Zitat das Nuance, Ambivalenz oder einen einzigartigen Blickwinkel zeigt
4-5. Weitere Zitate nur wenn sie genuinely neue Perspektiven bringen

Qualität vor Quantität — 3 exzellente Zitate sind besser als 5 mittelmässige.

═══ ANALYSEQUALITÄT ═══

- Struktur Zusammenfassung: (1) Allgemeine Tendenz, (2) Konsens, (3) Unterschiede, (4) Nuancen
- Hedging-Sprache: "tendierten dazu", "mehrere berichteten", "eine Person merkte an"
- STÄRKE der Positionen beachten: "stark positiv" vs. "leicht positiv"
- notable_patterns darf die Zusammenfassung NICHT wiederholen — nur überraschende Befunde
- Sentiment-Fehlklassifikationen in quality_notes markieren

═══ SELBSTPRÜFUNG (vor der Rückgabe) ═══
1. Alle Häufigkeitsangaben nochmals nachzählen — stimmen sie?
2. Jedes Zitat WÖRTLICH in den bereitgestellten Antworten prüfen
3. Prüfen dass "X der Befragten" verwendet wurde, NICHT "X von ${n}" oder "X von ${N}"
4. Sind die ausgewählten Zitate wirklich die aussagekräftigsten?

═══ AUSGABE ═══

Gib JSON zurück:
{
  "summary": "4-6 Sätze nach obiger Struktur",
  "notable_patterns": "2-3 Sätze — nur überraschende Befunde, keine Wiederholung aus der Zusammenfassung",
  "selected_quotes": [
    {
      "answer_id": "A1",
      "participant": "Name",
      "quote": "EXAKTER wörtlicher Text aus der Antwort",
      "relevance": "Begründung: repräsentiert Mehrheit / stärkste Gegenmeinung / einzigartige Einsicht / zeigt Nuance"
    }
  ],
  "quality_notes": "Sentiment-Fehlklassifikationen, Off-Topic-Antworten oder Datenprobleme. null falls keine."
}`;
}
