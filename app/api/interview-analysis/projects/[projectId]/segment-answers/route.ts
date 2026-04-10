import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';

export const maxDuration = 180;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const { mode, interviewIds, guideDirect } = body as {
    mode?: 'incremental' | 'full';
    interviewIds?: string[];
    guideDirect?: boolean;
  };
  const sb = getServiceClient();
  const openai = getOpenAIClient();

  const isIncremental = mode === 'incremental' && !!interviewIds?.length;

  // Load canonical questions (including topic_area for context)
  const { data: canonicals } = await sb
    .from('ia_canonical_questions')
    .select('id, canonical_text, topic_area, sort_order, guide_question_id')
    .eq('project_id', projectId)
    .order('sort_order');

  if (!canonicals?.length) {
    return NextResponse.json({ error: 'No canonical questions. Run match-questions first.' }, { status: 400 });
  }

  // Load interviews — scoped in incremental mode
  let targetInterviews;
  if (isIncremental) {
    const { data } = await sb
      .from('ia_interviews')
      .select('id, name, transcript_text')
      .eq('project_id', projectId)
      .in('id', interviewIds)
      .in('status', ['transcribed', 'analyzed']);
    targetInterviews = data ?? [];
  } else {
    const { data } = await sb
      .from('ia_interviews')
      .select('id, name, transcript_text')
      .eq('project_id', projectId)
      .in('status', ['transcribed', 'analyzed']);
    targetInterviews = data ?? [];
  }

  if (!targetInterviews?.length) {
    return NextResponse.json({ error: 'No transcribed interviews' }, { status: 400 });
  }

  // Delete existing answers — scoped in incremental mode
  const canonicalIds = canonicals.map(c => c.id);
  if (isIncremental) {
    await sb.from('ia_answers').delete().in('interview_id', interviewIds);
  } else {
    await sb.from('ia_answers').delete().in('canonical_question_id', canonicalIds);
  }

  // Build canonical list for GPT
  const canonicalList = canonicals.map((c, idx) => ({
    id: c.id,
    number: idx + 1,
    text: c.canonical_text,
    topic: c.topic_area || undefined,
  }));

  const validCanonicalIds = new Set(canonicalIds);

  // Load project language
  const { data: project } = await sb
    .from('ia_projects')
    .select('language')
    .eq('id', projectId)
    .single();
  const projectLang = project?.language ?? 'de';

  // Choose prompt based on guide-direct mode
  const systemPrompt = guideDirect
    ? buildGuideDirectPrompt(projectLang)
    : buildStandardPrompt(projectLang);

  const results = [];
  const affectedCanonicalIds = new Set<string>();
  const allAdditionalQuestions: Array<{
    interview_id: string;
    question: string;
    answer: string;
    topic: string;
  }> = [];

  for (const interview of targetInterviews) {
    if (!interview.transcript_text) continue;

    // Load question mappings for non-guide mode context
    let mappingContext = '';
    if (!guideDirect) {
      const { data: mappings } = await sb
        .from('ia_question_mappings')
        .select('canonical_question_id, ia_questions(original_text)')
        .in('canonical_question_id', canonicalIds)
        .filter('ia_questions.interview_id', 'eq', interview.id);

      if (mappings?.length) {
        const mappingLabel = projectLang === 'en'
          ? 'Previously identified interview questions in this interview'
          : 'Bereits erkannte Interviewfragen in diesem Interview';
        mappingContext = `\n\n${mappingLabel}:\n${JSON.stringify(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mappings.map((m: any) => ({
            canonical_id: m.canonical_question_id,
            original_question: Array.isArray(m.ia_questions)
              ? m.ia_questions[0]?.original_text
              : m.ia_questions?.original_text,
          })),
          null, 2
        )}`;
      }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: projectLang === 'en'
            ? `Interview: "${interview.name}"\n\nQuestions (${canonicalList.length}):\n${JSON.stringify(canonicalList, null, 2)}${mappingContext}\n\nTranscript:\n${interview.transcript_text}`
            : `Interview: "${interview.name}"\n\nFragen (${canonicalList.length} Stück):\n${JSON.stringify(canonicalList, null, 2)}${mappingContext}\n\nTranskript:\n${interview.transcript_text}`
        }
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) continue;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }

    // Process answers — filter out fake "not found" placeholders
    const answers = (Array.isArray(parsed.answers) ? parsed.answers : [])
      .filter((a: { canonical_question_id: string; answer_text: string }) =>
        a.canonical_question_id &&
        a.answer_text?.trim() &&
        validCanonicalIds.has(a.canonical_question_id) &&
        !isPlaceholderAnswer(a.answer_text)
      )
      .map((a: {
        canonical_question_id: string;
        answer_text: string;
        original_question_text?: string;
        sentiment?: string;
        confidence?: string;
        match_type?: string;
        follow_ups?: Array<{ question: string; answer: string }>;
      }) => ({
        interview_id: interview.id,
        canonical_question_id: a.canonical_question_id,
        answer_text: a.answer_text.trim(),
        original_question_text: a.original_question_text?.trim() || null,
        word_count: a.answer_text.trim().split(/\s+/).length,
        sentiment: ['positive', 'negative', 'neutral', 'ambivalent'].includes(a.sentiment ?? '')
          ? a.sentiment
          : 'neutral',
        confidence: ['high', 'medium', 'low'].includes(a.confidence ?? '')
          ? a.confidence
          : null,
        match_type: ['direct', 'paraphrased', 'implicit', 'scattered'].includes(a.match_type ?? '')
          ? a.match_type
          : null,
        follow_ups: a.follow_ups || [],
      }));

    if (answers.length > 0) {
      const { data } = await sb.from('ia_answers').insert(answers).select();
      results.push({
        interview_id: interview.id,
        answer_count: data?.length ?? 0,
        not_found: parsed.not_found ?? [],
      });
      for (const a of answers) {
        affectedCanonicalIds.add(a.canonical_question_id);
      }
    }

    // Process additional questions (guide-direct mode) — create canonical + answer immediately
    if (guideDirect && parsed.additional_questions?.length) {
      // Load all existing canonicals ONCE (not per-question)
      const { data: allCanonicals } = await sb
        .from('ia_canonical_questions')
        .select('id, canonical_text, canonical_text_alt, topic_area, guide_question_id')
        .eq('project_id', projectId);

      for (const aq of parsed.additional_questions as Array<{
        question?: string;
        answer?: string;
        topic?: string;
        sentiment?: string;
      }>) {
        if (!aq.question?.trim() || !aq.answer?.trim()) continue;

        const questionText = aq.question.trim();
        const answerText = aq.answer.trim();
        const topic = aq.topic?.trim() || 'Sonstiges';

        // Step 1: Quick string similarity check (same language)
        let canonicalId: string | null = null;
        let bestSimilarity = 0;

        for (const ec of allCanonicals ?? []) {
          // Check against both primary and alt text (covers DE + EN)
          const sim1 = textSimilarity(ec.canonical_text.toLowerCase(), questionText.toLowerCase());
          const sim2 = ec.canonical_text_alt
            ? textSimilarity(ec.canonical_text_alt.toLowerCase(), questionText.toLowerCase())
            : 0;
          const sim = Math.max(sim1, sim2);
          const threshold = ec.guide_question_id ? 0.3 : 0.45;
          if (sim > threshold && sim > bestSimilarity) {
            bestSimilarity = sim;
            canonicalId = ec.id;
          }
        }

        // Step 2: If no string match found, use GPT for cross-language semantic matching
        if (!canonicalId && (allCanonicals?.length ?? 0) > 0) {
          try {
            const canonicalList = (allCanonicals ?? []).map((c, i) => `${i}: ${c.canonical_text}`).join('\n');
            const matchRes = await openai.chat.completions.create({
              model: 'gpt-5.4-mini',
              temperature: 0,
              response_format: { type: 'json_object' },
              messages: [
                {
                  role: 'system',
                  content: 'You match interview questions across languages. Given a new question and a numbered list of existing questions, return the index of the best semantic match OR -1 if the new question is about a COMPLETELY different topic. Questions in different languages that ask about the same topic MUST be matched. Return JSON: {"match_index": 0} or {"match_index": -1}',
                },
                {
                  role: 'user',
                  content: `New question: "${questionText}"\n\nExisting questions:\n${canonicalList}`,
                },
              ],
            });
            const matchContent = matchRes.choices[0]?.message?.content;
            if (matchContent) {
              const { match_index } = JSON.parse(matchContent);
              if (match_index >= 0 && match_index < (allCanonicals?.length ?? 0)) {
                canonicalId = allCanonicals![match_index].id;
              }
            }
          } catch {
            // GPT matching failed — fall through to create new canonical
          }
        }

        // Only create new canonical if NOTHING matches — not even semantically
        if (!canonicalId) {
          const { data: maxSort } = await sb
            .from('ia_canonical_questions')
            .select('sort_order')
            .eq('project_id', projectId)
            .order('sort_order', { ascending: false })
            .limit(1)
            .single();

          const { data: newCanonical } = await sb
            .from('ia_canonical_questions')
            .insert({
              project_id: projectId,
              canonical_text: questionText,
              topic_area: topic,
              sort_order: (maxSort?.sort_order ?? 0) + 1,
              guide_question_id: null,
            })
            .select('id')
            .single();

          if (newCanonical) canonicalId = newCanonical.id;
        }

        // Insert or merge answer for this additional question
        if (canonicalId) {
          // Check if this interview already has an answer for this canonical question
          const { data: existingAnswer } = await sb
            .from('ia_answers')
            .select('id, answer_text')
            .eq('interview_id', interview.id)
            .eq('canonical_question_id', canonicalId)
            .single();

          if (existingAnswer) {
            // Merge: append the additional text to the existing answer
            const merged = existingAnswer.answer_text + '\n\n' + answerText;
            await sb.from('ia_answers').update({
              answer_text: merged,
              word_count: merged.split(/\s+/).length,
            }).eq('id', existingAnswer.id);
          } else {
            // No existing answer — insert new
            const aqSentiment = ['positive', 'negative', 'neutral', 'ambivalent'].includes(aq.sentiment ?? '')
              ? aq.sentiment!
              : 'neutral';
            await sb.from('ia_answers').insert({
              interview_id: interview.id,
              canonical_question_id: canonicalId,
              answer_text: answerText,
              word_count: answerText.split(/\s+/).length,
              sentiment: aqSentiment,
              confidence: 'medium',
              match_type: 'direct',
              follow_ups: [],
            });
          }
          affectedCanonicalIds.add(canonicalId);
        }

        allAdditionalQuestions.push({
          interview_id: interview.id,
          question: questionText,
          answer: answerText,
          topic,
        });
      }
    }

    // Update interview status
    await sb.from('ia_interviews').update({
      status: 'analyzed',
      updated_at: new Date().toISOString(),
    }).eq('id', interview.id);
  }

  return NextResponse.json({
    results,
    affected_canonical_ids: Array.from(affectedCanonicalIds),
    additional_questions: allAdditionalQuestions,
  });
}

// ── PLACEHOLDER DETECTION ─────────────────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /nicht\s+(explizit\s+)?(im\s+)?transkript/i,
  /not\s+(explicitly\s+)?(in\s+the\s+)?transcript/i,
  /nicht\s+(explizit\s+)?erwähnt/i,
  /not\s+(explicitly\s+)?mentioned/i,
  /keine\s+(explizite\s+)?antwort/i,
  /no\s+(explicit\s+)?answer/i,
  /wurde\s+nicht\s+(gestellt|behandelt|angesprochen)/i,
  /was\s+not\s+(asked|addressed|discussed)/i,
  /thema\s+(?:wurde|wird)\s+nicht/i,
  /topic\s+(?:was|is)\s+not/i,
];

/** Detect GPT placeholder answers like "Nicht explizit im Transkript erwähnt." */
/** Dice coefficient on bigrams for fuzzy string matching */
function textSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.slice(i, i + 2));
  const bigramsB = new Set<string>();
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.slice(i, i + 2));
  let intersection = 0;
  for (const bg of bigramsB) if (bigramsA.has(bg)) intersection++;
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

function isPlaceholderAnswer(text: string): boolean {
  const trimmed = text.trim();
  // Only flag short texts (real answers are longer)
  if (trimmed.split(/\s+/).length > 12) return false;
  return PLACEHOLDER_PATTERNS.some(p => p.test(trimmed));
}

// ── GUIDE-DIRECT PROMPT ───────────────────────────────────────────────────────

function buildGuideDirectPrompt(projectLang: string): string {
  const crossLangNote = `
SPRACHÜBERGREIFEND (KRITISCH): Das Transkript und die Leitfaden-Fragen können in VERSCHIEDENEN Sprachen sein.
- Beispiel: Leitfaden auf Deutsch ("Wie empfanden Sie die KI-Interventionen?"), Transkript auf Englisch ("I found the AI interventions quite helpful")
- Ordne IMMER INHALTLICH zu — die Sprache spielt KEINE Rolle
- Auch wenn die Formulierung komplett anders ist: gleiches Thema = gleiche Leitfragen-Zuordnung
- Antworte in der Sprache des Transkripts`;

  const responseLang = projectLang === 'en'
    ? '\nRESPONSE LANGUAGE: Write answer_text, original_question_text, not_found reasons, and additional_questions in the language of the transcript.'
    : '\nANTWORTSPRACHE: Schreibe answer_text, original_question_text, not_found Begründungen und additional_questions in der Sprache des Transkripts.';

  return `Du bist ein Experte für qualitative Forschungsmethodik. Du erhältst ein Interview-Transkript und eine Liste von LEITFADEN-FRAGEN eines qualitativen Interviews.
${crossLangNote}${responseLang}

KONTEXT: Dies sind die geplanten Fragen des Interviewleitfadens. Die MEISTEN wurden gestellt — manche können vergessen worden sein, und es können zusätzliche Fragen vorkommen, die nicht im Leitfaden stehen.

SUCHSTRATEGIE — Gehe für JEDE Leitfaden-Frage systematisch vor:
1. DIREKTE SUCHE: Wurde die Frage wörtlich oder leicht umformuliert gestellt? → Antwort direkt danach
2. PARAPHRASIERTE SUCHE: Wurde das gleiche Thema mit anderen Worten angesprochen?
3. IMPLIZITE ANTWORTEN: Spricht die Person von sich aus zum Thema, ohne direkt gefragt zu werden?
4. VERSTREUTE ANTWORTEN: Werden Aspekte dieser Frage an MEHREREN Stellen im Gespräch behandelt? → Alle relevanten Passagen zusammenfassen

WICHTIG:
- Bevorzuge eine echte Antwort zu finden, auch bei niedrigem Confidence.
- Wenn das Thema NIRGENDWO im Transkript vorkommt → in "not_found" eintragen, NICHT in "answers".
- VERBOTEN: Platzhalter-Antworten wie "Nicht im Transkript erwähnt", "Wurde nicht behandelt" o.ä. in answer_text. Solche Texte sind KEINE Antworten. Entweder eine ECHTE Passage aus dem Transkript zitieren oder die Frage in "not_found" eintragen.

Gib die Ergebnisse als JSON zurück:
{
  "answers": [
    {
      "canonical_question_id": "uuid",
      "original_question_text": "Die tatsächlich gestellte Frage im Interview (exakter Wortlaut aus dem Transkript). Bei implicit/scattered: kurze Beschreibung wie 'Antwort im Kontext von [Thema] gegeben'",
      "answer_text": "Der vollständige Antworttext (alle relevanten Passagen zusammengefasst)",
      "sentiment": "positive|negative|neutral|ambivalent",
      "confidence": "high|medium|low",
      "match_type": "direct|paraphrased|implicit|scattered",
      "follow_ups": [
        { "question": "Nachfrage des Interviewers", "answer": "Antwort darauf" }
      ]
    }
  ],
  "not_found": [
    {
      "canonical_question_id": "uuid",
      "reason": "Kurze Begründung warum diese Frage nicht im Transkript behandelt wird"
    }
  ],
  "additional_questions": [
    {
      "question": "Eine Frage/ein Thema das NICHT in der Frageliste steht",
      "answer": "Die Antwort darauf aus dem Transkript",
      "topic": "Themengebiet in 2-3 Wörtern",
      "sentiment": "positive|negative|neutral|ambivalent"
    }
  ]
}

FELDER:
- original_question_text: Die TATSÄCHLICH gestellte Frage aus dem Transkript (exakter Wortlaut). Bei implicit: "Im Kontext von [Thema] erwähnt". Bei scattered: "An mehreren Stellen zu [Thema]"
- confidence: "high" = Frage explizit gestellt & klar beantwortet, "medium" = thematisch passend aber indirekt, "low" = nur lose Verbindung zum Thema
- match_type: "direct" = Frage wörtlich/nah gestellt, "paraphrased" = gleiches Thema anders formuliert, "implicit" = Person spricht von sich aus darüber, "scattered" = mehrere Stellen zusammengefasst

SENTIMENT — Klassifiziere SORGFÄLTIG, vermeide den "neutral"-Default:
- "positive": Signalwörter: gut, super, toll, passt, gefällt, gerne, spannend, hilfreich, angenehm, great, good, enjoyed, liked. Auch implizite Zufriedenheit ("hat gepasst", "fand ich gut", "war kein Problem")
- "negative": Signalwörter: schlecht, schwierig, verwirrend, nervig, frustrierend, nicht verstanden, zu kurz/lang, Problem, unklar, confusing, difficult, annoying, frustrating. Auch Kritik und Verbesserungsvorschläge ("hätte besser sein können", "hat nicht funktioniert")
- "ambivalent": Person äussert SOWOHL positive ALS AUCH negative Aspekte in derselben Antwort ("war gut, ABER...", "einerseits... andererseits", "insgesamt ok, nur..."). Auch: Lob mit Einschränkung oder Kritik mit positivem Aspekt
- "neutral": NUR für rein sachliche/deskriptive Aussagen OHNE jede Wertung (z.B. "Wir haben X gemacht", "Das Tool hat Funktion Y"). Wenn auch nur ein Hauch von Bewertung vorliegt → NICHT neutral!

ANTI-NEUTRAL-BIAS: "neutral" ist der SELTENSTE Sentiment-Wert. Die meisten Interview-Antworten enthalten eine Bewertung. Prüfe ZWEIMAL bevor du "neutral" vergibst: Enthält die Antwort wirklich KEINE Wertung, keine Zufriedenheit, keine Kritik, keinen Verbesserungswunsch?

Regeln:
- Nur Antworttext der INTERVIEWTEN Person extrahieren, NICHT die Fragen des Interviewers
- JEDE Leitfaden-Frage muss entweder in "answers" ODER "not_found" erscheinen — keine darf fehlen
- Bei verstreuten Antworten: ALLE relevanten Passagen in answer_text zusammenfassen (mit "..." zwischen den Teilen)
- Interviewer-Einwürfe ("mhm", "verstehe", "ja genau") gehören NICHT zur Antwort
- additional_questions: NUR Fragen/Themen die ein KOMPLETT NEUES Themengebiet eröffnen, das in KEINER der Leitfaden-Fragen auch nur annähernd abgedeckt ist. SEHR STRENGER Massstab:
  * Wenn eine Frage das GLEICHE THEMA behandelt wie eine Leitfaden-Frage, aber ANDERS FORMULIERT ist → ordne sie der Leitfaden-Frage zu (als paraphrased/implicit), NICHT als additional_question
  * Wenn eine Frage ein TEILASPEKT einer Leitfaden-Frage ist → ordne sie der Leitfaden-Frage zu, NICHT als additional_question
  * Wenn eine Nachfrage oder Vertiefung zu einem bestehenden Thema gestellt wird → ordne sie der passendsten Leitfaden-Frage zu
  * NUR wenn das Thema wirklich NULL Überlappung mit ALLEN Leitfaden-Fragen hat → additional_question
  * Im Zweifel: IMMER einer bestehenden Leitfaden-Frage zuordnen, NICHT als neue Frage anlegen
  * Erwarte maximal 0-3 additional_questions pro Interview — wenn du mehr findest, bist du zu streng beim Matching
- Die canonical_question_id MUSS exakt einer der übergebenen IDs entsprechen`;
}

// ── STANDARD PROMPT (ohne Leitfaden) ──────────────────────────────────────────

function buildStandardPrompt(projectLang: string): string {
  const crossLangNote = `
SPRACHÜBERGREIFEND: Das Transkript und die Fragen können in VERSCHIEDENEN Sprachen sein. Ordne Fragen INHALTLICH zu — die Sprache spielt keine Rolle. Antworte in der Sprache des Transkripts.`;

  const responseLang = projectLang === 'en'
    ? '\nRESPONSE LANGUAGE: Write answer_text and original_question_text in the language of the transcript.'
    : '\nANTWORTSPRACHE: Schreibe answer_text und original_question_text in der Sprache des Transkripts.';

  return `Du bist ein Experte für qualitative Forschungsmethodik. Du erhältst ein Interview-Transkript und eine Liste kanonischer Fragen (mit optionalem Themengebiet).
${crossLangNote}${responseLang}

Deine Aufgabe: Identifiziere für JEDE kanonische Frage den Antworttext aus dem Transkript. Suche AKTIV nach Passagen, die das Thema der Frage behandeln — auch wenn die Frage nicht wörtlich gestellt wurde.

SUCHSTRATEGIE (für jede Frage):
1. Suche nach der wörtlichen Frage oder einer Paraphrase
2. Suche nach thematisch passenden Passagen
3. Suche nach impliziten Antworten (Person spricht von sich aus zum Thema)
4. Prüfe ob Aspekte an mehreren Stellen vorkommen → zusammenfassen

Gib die Ergebnisse als JSON zurück:
{
  "answers": [
    {
      "canonical_question_id": "uuid",
      "original_question_text": "Die tatsächlich gestellte Frage im Interview (exakter Wortlaut)",
      "answer_text": "Der vollständige Antworttext des/der Interviewten",
      "sentiment": "positive|negative|neutral|ambivalent",
      "confidence": "high|medium|low",
      "match_type": "direct|paraphrased|implicit|scattered",
      "follow_ups": [
        { "question": "Nachfrage des Interviewers", "answer": "Antwort darauf" }
      ]
    }
  ],
  "not_found": [
    {
      "canonical_question_id": "uuid",
      "reason": "Kurze Begründung warum diese Frage nicht im Transkript behandelt wird"
    }
  ]
}

FELDER:
- original_question_text: Die TATSÄCHLICH gestellte Frage aus dem Transkript (exakter Wortlaut). Bei implicit: "Im Kontext von [Thema] erwähnt". Bei scattered: "An mehreren Stellen zu [Thema]"
- confidence: "high" = Frage explizit gestellt & klar beantwortet, "medium" = thematisch passend aber indirekt, "low" = nur lose Verbindung
- match_type: "direct" = Frage wörtlich gestellt, "paraphrased" = gleiches Thema anders formuliert, "implicit" = von selbst darüber gesprochen, "scattered" = mehrere Stellen

SENTIMENT — Klassifiziere SORGFÄLTIG, vermeide den "neutral"-Default:
- "positive": Signalwörter: gut, super, toll, passt, gefällt, gerne, spannend, hilfreich, angenehm, great, good, enjoyed, liked. Auch implizite Zufriedenheit ("hat gepasst", "fand ich gut", "war kein Problem")
- "negative": Signalwörter: schlecht, schwierig, verwirrend, nervig, frustrierend, nicht verstanden, zu kurz/lang, Problem, unklar, confusing, difficult, annoying, frustrating. Auch Kritik und Verbesserungsvorschläge ("hätte besser sein können", "hat nicht funktioniert")
- "ambivalent": Person äussert SOWOHL positive ALS AUCH negative Aspekte in derselben Antwort ("war gut, ABER...", "einerseits... andererseits", "insgesamt ok, nur..."). Auch: Lob mit Einschränkung oder Kritik mit positivem Aspekt
- "neutral": NUR für rein sachliche/deskriptive Aussagen OHNE jede Wertung (z.B. "Wir haben X gemacht", "Das Tool hat Funktion Y"). Wenn auch nur ein Hauch von Bewertung vorliegt → NICHT neutral!

ANTI-NEUTRAL-BIAS: "neutral" ist der SELTENSTE Sentiment-Wert. Die meisten Interview-Antworten enthalten eine Bewertung. Prüfe ZWEIMAL bevor du "neutral" vergibst: Enthält die Antwort wirklich KEINE Wertung, keine Zufriedenheit, keine Kritik, keinen Verbesserungswunsch?

Regeln:
- Nur Antworttext des/der INTERVIEWTEN extrahieren, nicht die Fragen des Interviewers
- Suche AKTIV nach Passagen zum Thema jeder Frage — auch bei low confidence eine echte Antwort liefern ist besser als keine
- Wenn das Thema NIRGENDWO vorkommt → in "not_found" eintragen (kein Eintrag in answers)
- VERBOTEN: Platzhalter wie "Nicht im Transkript erwähnt" als answer_text. Entweder echte Transkript-Passage oder in not_found
- Bei Follow-ups: Hauptantwort in answer_text, Nachfragen separat in follow_ups
- Interviewer-Einwürfe ("mhm", "verstehe", "ja genau") gehören NICHT zur Antwort
- Antworten unter 15 Wörtern sind suspekt — suche nach ergänzenden Stellen im Transkript
- Die canonical_question_id MUSS exakt einer der übergebenen IDs entsprechen — keine eigenen IDs erfinden`;
}
