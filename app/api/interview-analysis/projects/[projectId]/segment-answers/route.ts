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
        mappingContext = `\n\nBereits erkannte Interviewfragen in diesem Interview:\n${JSON.stringify(
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
          content: `Interview: "${interview.name}"

Fragen (${canonicalList.length} Stück):
${JSON.stringify(canonicalList, null, 2)}${mappingContext}

Transkript:
${interview.transcript_text}`
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

    // Collect additional questions (guide-direct mode)
    if (guideDirect && parsed.additional_questions?.length) {
      for (const aq of parsed.additional_questions) {
        if (aq.question?.trim() && aq.answer?.trim()) {
          allAdditionalQuestions.push({
            interview_id: interview.id,
            question: aq.question.trim(),
            answer: aq.answer.trim(),
            topic: aq.topic?.trim() || 'Sonstiges',
          });
        }
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
function isPlaceholderAnswer(text: string): boolean {
  const trimmed = text.trim();
  // Only flag short texts (real answers are longer)
  if (trimmed.split(/\s+/).length > 12) return false;
  return PLACEHOLDER_PATTERNS.some(p => p.test(trimmed));
}

// ── GUIDE-DIRECT PROMPT ───────────────────────────────────────────────────────

function buildGuideDirectPrompt(projectLang: string): string {
  const crossLangNote = `
SPRACHÜBERGREIFEND: Das Transkript und die Leitfaden-Fragen können in VERSCHIEDENEN Sprachen sein (z.B. Fragen auf Deutsch, Interview auf Englisch oder umgekehrt). Ordne Fragen INHALTLICH zu — die Sprache spielt keine Rolle. Antworte in der Sprache des Transkripts.`;

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
      "topic": "Themengebiet in 2-3 Wörtern"
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
- additional_questions: Nur SUBSTANTIELLE Fragen/Themen die klar NICHT in der Frageliste abgedeckt sind
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
