import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';

export const maxDuration = 120;

/**
 * POST: Generate AI-verified scientific analysis for one canonical question.
 *
 * The AI receives ALL verbatim answers and must:
 * 1. Write a scientific summary (trends, consensus, disagreements)
 * 2. Identify notable patterns / surprising findings
 * 3. Select the 3-5 most meaningful quotes WITH justification
 * 4. Cross-check: flag any answers that seem inconsistent or possibly misclassified
 *
 * CRITICAL: The AI must ONLY use verbatim quotes from the provided answers.
 * It must NOT invent, paraphrase, or embellish any quotes.
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

  // Load project
  const { data: project } = await sb
    .from('ia_projects')
    .select('language')
    .eq('id', projectId)
    .single();
  const isEn = (project?.language ?? 'de') === 'en';

  // Load canonical question
  const { data: cq } = await sb
    .from('ia_canonical_questions')
    .select('*')
    .eq('id', canonicalQuestionId)
    .single();

  if (!cq) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  // Load all answers with interview names
  const { data: answers } = await sb
    .from('ia_answers')
    .select('*, ia_interviews(name, group_label)')
    .eq('canonical_question_id', canonicalQuestionId);

  if (!answers?.length) {
    return NextResponse.json({ error: 'No answers' }, { status: 400 });
  }

  // Load total interview count
  const { count: totalInterviews } = await sb
    .from('ia_interviews')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .in('status', ['transcribed', 'analyzed']);

  // Build answer data for GPT
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

  // Sentiment distribution
  const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0, ambivalent: 0 };
  for (const a of answers) sentimentCounts[a.sentiment || 'neutral']++;

  const systemPrompt = isEn
    ? `You are a senior qualitative research analyst preparing a peer-reviewed scientific interview analysis report. You have extensive experience with thematic analysis (Braun & Clarke) and content analysis methodology.

You receive one research question and ALL verbatim participant responses. Your task is a rigorous, publication-ready structured analysis.

═══ SCIENTIFIC INTEGRITY REQUIREMENTS ═══

QUOTING:
- The "quote" field must contain text EXACTLY as it appears in the provided answers — character for character, including grammar errors, filler words, and incomplete sentences.
- Do NOT clean up, paraphrase, shorten, combine, or improve quotes in any way.
- If a quote is too long, you may truncate it with "[...]" but the included parts must be VERBATIM.
- If you cannot find a suitable verbatim passage, do NOT fabricate one — explain in the relevance field.

ANALYSIS:
- Every factual claim must cite frequencies: "X of Y participants" (absolute AND relative).
- Distinguish clearly: consensus (>80%), majority (>50%), split opinion (~50/50), minority (<30%), individual outlier (1 person).
- Use appropriate hedging language: "tended to", "several reported", "one participant noted" — NOT "everyone", "always", "clearly".
- Note the STRENGTH of positions, not just their direction (e.g., "strongly positive" vs. "mildly positive").
- If group labels exist, note any between-group differences.

CRITICAL SELF-CHECK before returning:
1. Are all frequency claims correct? Count again.
2. Does each quote appear VERBATIM in the provided answers? Verify character by character.
3. Are the selected quotes truly representative, or do they over-represent one viewpoint?
4. Are any sentiment classifications obviously wrong? Flag them.

═══ OUTPUT FORMAT ═══

Return JSON:
{
  "summary": "4-6 sentences. Structure: (1) Overall tendency, (2) Points of agreement with frequency, (3) Points of disagreement with frequency, (4) Notable nuances. Always use 'X of Y participants (Z%)' format.",
  "notable_patterns": "2-4 sentences. Focus on: (a) Surprising or counter-intuitive findings, (b) Answers that contradicted the majority, (c) Unexpected connections between ideas, (d) Particularly strong emotional responses. Do NOT repeat what the summary already says.",
  "selected_quotes": [
    {
      "answer_id": "A1",
      "participant": "Name",
      "quote": "EXACT verbatim text — character for character from the answer",
      "relevance": "Scientific justification: 'Represents the majority position held by X of Y participants' / 'Strongest dissenting view' / 'Only participant to mention [aspect]' / 'Illustrates the ambivalence present in X responses'"
    }
  ],
  "quality_notes": "Flag: (a) sentiment misclassifications with correction suggestion, (b) answers that may not actually address this question (off-topic), (c) near-duplicate answers that may indicate a data issue, (d) answers where the match_type seems wrong. Return null ONLY if genuinely no issues found — err on the side of flagging."
}

QUOTE SELECTION STRATEGY (select exactly 3-5):
1. One quote representing the MAJORITY position (most common theme/sentiment)
2. One quote representing a DISSENTING or MINORITY view (if exists)
3. One quote that is particularly ARTICULATE or INSIGHTFUL
4. One quote showing AMBIVALENCE or NUANCE (if exists)
5. One quote that is SURPRISING or UNIQUE (if exists)
Each quote must come from a DIFFERENT participant.

Write in English.`

    : `Du bist ein erfahrener qualitativer Forschungsanalyst, der einen peer-review-fähigen wissenschaftlichen Interview-Analysebericht erstellt. Du hast umfassende Erfahrung mit thematischer Analyse (Braun & Clarke) und Inhaltsanalyse-Methodik.

Du erhältst eine Forschungsfrage und ALLE wörtlichen Teilnehmerantworten. Deine Aufgabe ist eine rigorose, publikationsreife strukturierte Analyse.

═══ WISSENSCHAFTLICHE INTEGRITÄTSANFORDERUNGEN ═══

ZITIEREN:
- Das "quote"-Feld muss Text EXAKT so enthalten, wie er in den bereitgestellten Antworten erscheint — Zeichen für Zeichen, inklusive Grammatikfehler, Füllwörter und unvollständiger Sätze.
- NICHT bereinigen, paraphrasieren, kürzen, kombinieren oder verbessern.
- Bei zu langen Zitaten darfst du mit "[...]" kürzen, aber die enthaltenen Teile müssen WÖRTLICH sein.
- Wenn du keine passende wörtliche Passage findest, erfinde KEINE — erkläre es im relevance-Feld.

ANALYSE:
- Jede faktische Aussage muss Häufigkeiten nennen: "X von Y Teilnehmenden" (absolut UND relativ).
- Unterscheide klar: Konsens (>80%), Mehrheit (>50%), geteilte Meinung (~50/50), Minderheit (<30%), Einzelmeinung (1 Person).
- Verwende angemessene Hedging-Sprache: "tendierten dazu", "mehrere berichteten", "eine Person merkte an" — NICHT "alle", "immer", "eindeutig".
- Beachte die STÄRKE der Positionen, nicht nur deren Richtung (z.B. "stark positiv" vs. "leicht positiv").
- Falls Gruppenlabels existieren, notiere Unterschiede zwischen den Gruppen.

KRITISCHE SELBSTPRÜFUNG vor der Rückgabe:
1. Sind alle Häufigkeitsangaben korrekt? Nochmals zählen.
2. Erscheint jedes Zitat WÖRTLICH in den bereitgestellten Antworten? Zeichen für Zeichen prüfen.
3. Sind die ausgewählten Zitate wirklich repräsentativ oder überrepräsentieren sie eine Sichtweise?
4. Sind Sentiment-Klassifikationen offensichtlich falsch? Markieren.

═══ AUSGABEFORMAT ═══

Gib JSON zurück:
{
  "summary": "4-6 Sätze. Struktur: (1) Allgemeine Tendenz, (2) Übereinstimmungspunkte mit Häufigkeit, (3) Unterschiede mit Häufigkeit, (4) Bemerkenswerte Nuancen. Immer 'X von Y Teilnehmenden (Z%)' Format verwenden.",
  "notable_patterns": "2-4 Sätze. Fokus auf: (a) Überraschende oder kontraintuitive Befunde, (b) Antworten die der Mehrheit widersprachen, (c) Unerwartete Verbindungen zwischen Ideen, (d) Besonders starke emotionale Reaktionen. NICHT wiederholen was die Zusammenfassung schon sagt.",
  "selected_quotes": [
    {
      "answer_id": "A1",
      "participant": "Name",
      "quote": "EXAKTER wörtlicher Text — Zeichen für Zeichen aus der Antwort",
      "relevance": "Wissenschaftliche Begründung: 'Repräsentiert die Mehrheitsposition von X von Y Teilnehmenden' / 'Stärkste Gegenmeinung' / 'Einzige Person die [Aspekt] erwähnte' / 'Illustriert die Ambivalenz in X Antworten'"
    }
  ],
  "quality_notes": "Markiere: (a) Sentiment-Fehlklassifikationen mit Korrekturvorschlag, (b) Antworten die die Frage möglicherweise nicht adressieren (off-topic), (c) Fast-Duplikate die auf ein Datenproblem hindeuten, (d) Antworten bei denen der match_type falsch erscheint. Nur null zurückgeben wenn WIRKLICH keine Auffälligkeiten — im Zweifel markieren."
}

ZITAT-AUSWAHL-STRATEGIE (genau 3-5 auswählen):
1. Ein Zitat das die MEHRHEITSPOSITION repräsentiert (häufigstes Thema/Sentiment)
2. Ein Zitat einer GEGENMEINUNG oder MINDERHEITSPOSITION (falls vorhanden)
3. Ein Zitat das besonders ARTIKULIERT oder AUFSCHLUSSREICH ist
4. Ein Zitat das AMBIVALENZ oder NUANCE zeigt (falls vorhanden)
5. Ein Zitat das ÜBERRASCHEND oder EINZIGARTIG ist (falls vorhanden)
Jedes Zitat muss von einem ANDEREN Teilnehmenden stammen.

Schreibe auf Deutsch.`;

  const userContent = `${isEn ? 'Question' : 'Frage'}: "${cq.canonical_text}"
${cq.topic_area ? `Topic: ${cq.topic_area}` : ''}
${isEn ? 'Coverage' : 'Abdeckung'}: ${answers.length}/${totalInterviews ?? answers.length}
Sentiment: ${Object.entries(sentimentCounts).filter(([,c]) => c > 0).map(([s,c]) => `${s}: ${c}`).join(', ')}

${isEn ? 'All answers' : 'Alle Antworten'}:
${JSON.stringify(answerData, null, 2)}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.4',
      temperature: 0.2,
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

    // Post-validation: verify quotes are actually verbatim
    const answerTexts = new Set(answerData.map(a => a.text));
    const validatedQuotes = (analysis.selected_quotes ?? []).map((q: {
      answer_id: string;
      participant: string;
      quote: string;
      relevance: string;
    }) => {
      // Check if quote exists verbatim in any answer
      const isVerbatim = answerData.some(a =>
        a.text.includes(q.quote) || q.quote.includes(a.text)
      );
      return {
        ...q,
        verified: isVerbatim,
      };
    });

    return NextResponse.json({
      canonical_question_id: canonicalQuestionId,
      question_text: cq.canonical_text,
      summary: analysis.summary,
      notable_patterns: analysis.notable_patterns,
      selected_quotes: validatedQuotes,
      quality_notes: analysis.quality_notes ?? null,
      answer_count: answers.length,
      total_interviews: totalInterviews,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
