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
  const { mode, interviewIds, guideDirect } = body as {
    mode?: 'incremental' | 'full';
    interviewIds?: string[];
    guideDirect?: boolean;
  };
  const sb = getServiceClient();
  const openai = getOpenAIClient();

  // ── GUIDE-DIRECT MODE: create canonicals deterministically from guide questions ──
  if (guideDirect) {
    return handleGuideDirect(projectId, sb);
  }

  // ── INCREMENTAL MODE: match only new questions against existing canonicals ──
  if (mode === 'incremental' && interviewIds?.length) {
    return handleIncremental(projectId, interviewIds, sb, openai);
  }

  // ── FULL MODE (default): existing behavior — rebuild from scratch ──

  // Load all questions grouped by interview
  const { data: interviews } = await sb
    .from('ia_interviews')
    .select('id, name')
    .eq('project_id', projectId)
    .order('created_at');

  if (!interviews?.length) {
    return NextResponse.json({ error: 'No interviews found' }, { status: 400 });
  }

  const { data: allQuestions } = await sb
    .from('ia_questions')
    .select('*')
    .in('interview_id', interviews.map(i => i.id))
    .order('created_at');

  if (!allQuestions?.length) {
    return NextResponse.json({ error: 'No questions extracted yet. Run extract-questions first.' }, { status: 400 });
  }

  // Group questions by interview
  const interviewMap = new Map(interviews.map(i => [i.id, i.name]));
  const groupedQuestions = allQuestions.map(q => ({
    id: q.id,
    interview: interviewMap.get(q.interview_id) || q.interview_id,
    interview_id: q.interview_id,
    original: q.original_text,
    normalized: q.normalized_text,
    topic: q.topic,
    is_followup: q.is_followup,
  }));

  // Load guide questions if they exist
  const { data: guideQuestions } = await sb
    .from('ia_guide_questions')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');

  const hasGuide = (guideQuestions?.length ?? 0) > 0;

  // Build a set of valid question IDs for post-validation (GPT may hallucinate IDs)
  const validQuestionIds = new Set(allQuestions.map(q => q.id));

  // Build the GPT prompt — different strategy with/without guide
  const systemPrompt = hasGuide
    ? `Du bist ein Experte für qualitative Forschungsmethodik. Du erhältst:
1. Vordefinierte Leitfaden-Fragen (die Ankerfragen des Forschers)
2. Extrahierte Fragen aus mehreren Interviews

Deine Aufgabe: Ordne jede extrahierte Frage einer Leitfaden-Frage zu ODER erstelle neue kanonische Fragen für Themen, die nicht im Leitfaden abgedeckt sind.

Gib die Ergebnisse als JSON zurück:
{
  "guide_mappings": [
    {
      "guide_index": 0,
      "question_ids": ["id1", "id2"],
      "similarities": [0.95, 0.88]
    }
  ],
  "new_canonical_questions": [
    {
      "canonical_text": "Neue Frage, die nicht im Leitfaden war",
      "topic_area": "Themengebiet",
      "question_ids": ["id3"],
      "similarities": [0.90]
    }
  ]
}

Regeln:
- Leitfaden-Fragen haben PRIORITÄT: Ordne extrahierte Fragen bevorzugt einer Leitfaden-Frage zu, auch wenn die Formulierung stark abweicht — das Thema/der Aspekt zählt
- Similarity-Wert (0-1): 0.5+ reicht für Zuordnung bei gleichem Thema
- Erstelle neue kanonische Fragen NUR für Themen/Aspekte, die klar NICHT im Leitfaden enthalten sind
- Follow-up-Fragen zu einer Leitfaden-Frage werden dieser zugeordnet (nicht als neue Frage), es sei denn, sie behandeln ein klar eigenständiges Thema
- Jede extrahierte Frage muss genau EINER Frage zugeordnet werden (entweder Leitfaden oder neu)
- Die question_ids MÜSSEN exakt den übergebenen IDs entsprechen — keine eigenen IDs erfinden
- Neue kanonische Fragen bitte in logischer Reihenfolge sortieren`
    : `Du bist ein Experte für qualitative Forschungsmethodik. Du erhältst extrahierte Fragen aus mehreren Interviews eines Forschungsprojekts.

Deine Aufgabe: Gruppiere semantisch identische/ähnliche Fragen zu "Kanonischen Fragen". Auch wenn Fragen unterschiedlich formuliert sind, gehören sie zusammen, wenn sie dasselbe Thema/Aspekt erfragen.

Gib die Ergebnisse als JSON zurück:
{
  "canonical_questions": [
    {
      "canonical_text": "Die beste standardisierte Formulierung dieser Frage",
      "topic_area": "Übergeordnetes Themengebiet",
      "question_ids": ["id1", "id2", ...],
      "similarities": [0.95, 0.88, ...]
    }
  ]
}

Regeln:
- Jede Frage muss genau EINER kanonischen Frage zugeordnet werden
- Sortiere kanonische Fragen in der typischen Interview-Reihenfolge (Einstieg → Hauptteil → Abschluss)
- Follow-up-Fragen können einer eigenen kanonischen Frage zugeordnet werden, wenn sie in mehreren Interviews vorkommen
- Similarity-Wert (0-1) gibt an, wie ähnlich die Originalfrage der kanonischen Formulierung ist
- Die question_ids MÜSSEN exakt den übergebenen IDs entsprechen — keine eigenen IDs erfinden
- Bevorzuge die klarste/prägnanteste Formulierung als canonical_text`;

  const userContent = hasGuide
    ? `Leitfaden-Fragen:\n${guideQuestions!.map((g, i) => `${i}. [${g.topic_area || 'Allgemein'}] ${g.question_text}`).join('\n')}\n\nExtrahierte Fragen aus ${interviews.length} Interviews:\n\n${JSON.stringify(groupedQuestions, null, 2)}`
    : `Fragen aus ${interviews.length} Interviews:\n\n${JSON.stringify(groupedQuestions, null, 2)}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: 'No response from GPT' }, { status: 500 });
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'Failed to parse GPT response' }, { status: 500 });
  }

  // Clear existing canonical questions and mappings for this project
  const { data: existingCanonicals } = await sb
    .from('ia_canonical_questions')
    .select('id')
    .eq('project_id', projectId);

  if (existingCanonicals?.length) {
    const ids = existingCanonicals.map(c => c.id);
    await sb.from('ia_question_mappings').delete().in('canonical_question_id', ids);
    await sb.from('ia_answers').delete().in('canonical_question_id', ids);
    await sb.from('ia_question_summaries').delete().in('canonical_question_id', ids);
    await sb.from('ia_canonical_questions').delete().eq('project_id', projectId);
  }

  const results = [];

  if (hasGuide) {
    // GUIDE PATH: Pre-seed canonical questions from guide, then add extras

    // 1. Insert guide questions as canonical questions
    const guideCanonicalMap = new Map<number, string>(); // guide_index → canonical_id
    for (let i = 0; i < guideQuestions!.length; i++) {
      const gq = guideQuestions![i];
      const { data: inserted } = await sb
        .from('ia_canonical_questions')
        .insert({
          project_id: projectId,
          canonical_text: gq.question_text,
          topic_area: gq.topic_area,
          sort_order: i,
          guide_question_id: gq.id,
        })
        .select()
        .single();
      if (inserted) {
        guideCanonicalMap.set(i, inserted.id);
        results.push({ ...inserted, mapping_count: 0 });
      }
    }

    // 2. Process guide_mappings from GPT
    const guideMappings: Array<{ guide_index: number; question_ids: string[]; similarities: number[] }> =
      parsed.guide_mappings ?? [];
    for (const gm of guideMappings) {
      const canonicalId = guideCanonicalMap.get(gm.guide_index);
      if (!canonicalId) continue;

      const questionIds: string[] = gm.question_ids ?? [];
      const similarities: number[] = gm.similarities ?? [];
      const mappings = questionIds
        .map((qId, j) => ({
          canonical_question_id: canonicalId,
          question_id: qId,
          similarity: similarities[j] ?? null,
        }))
        .filter(m => validQuestionIds.has(m.question_id)); // Filter hallucinated IDs

      if (mappings.length > 0) {
        await sb.from('ia_question_mappings').insert(mappings);
        const r = results.find(r => r.id === canonicalId);
        if (r) r.mapping_count = mappings.length;
      }
    }

    // 3. Insert new canonical questions (not in guide)
    const newCanonicals: Array<{ canonical_text: string; topic_area?: string; question_ids: string[]; similarities: number[] }> =
      parsed.new_canonical_questions ?? [];
    for (let i = 0; i < newCanonicals.length; i++) {
      const cq = newCanonicals[i];
      const { data: inserted } = await sb
        .from('ia_canonical_questions')
        .insert({
          project_id: projectId,
          canonical_text: cq.canonical_text,
          topic_area: cq.topic_area || null,
          sort_order: guideQuestions!.length + i,
          guide_question_id: null,
        })
        .select()
        .single();

      if (!inserted) continue;

      const questionIds: string[] = cq.question_ids ?? [];
      const similarities: number[] = cq.similarities ?? [];
      const mappings = questionIds
        .map((qId, j) => ({
          canonical_question_id: inserted.id,
          question_id: qId,
          similarity: similarities[j] ?? null,
        }))
        .filter(m => validQuestionIds.has(m.question_id)); // Filter hallucinated IDs

      if (mappings.length > 0) {
        await sb.from('ia_question_mappings').insert(mappings);
      }

      results.push({ ...inserted, mapping_count: mappings.length });
    }
  } else {
    // NO-GUIDE PATH: Original logic
    const canonicals = parsed.canonical_questions ?? [];

    for (let i = 0; i < canonicals.length; i++) {
      const cq = canonicals[i];

      const { data: inserted } = await sb
        .from('ia_canonical_questions')
        .insert({
          project_id: projectId,
          canonical_text: cq.canonical_text,
          topic_area: cq.topic_area || null,
          sort_order: i,
        })
        .select()
        .single();

      if (!inserted) continue;

      const questionIds: string[] = cq.question_ids ?? [];
      const similarities: number[] = cq.similarities ?? [];
      const mappings = questionIds
        .map((qId: string, j: number) => ({
          canonical_question_id: inserted.id,
          question_id: qId,
          similarity: similarities[j] ?? null,
        }))
        .filter(m => validQuestionIds.has(m.question_id)); // Filter hallucinated IDs

      if (mappings.length > 0) {
        await sb.from('ia_question_mappings').insert(mappings);
      }

      results.push({ ...inserted, mapping_count: mappings.length });
    }
  }

  return NextResponse.json({ canonical_questions: results });
}

// ── GUIDE-DIRECT: Deterministic canonical creation from guide questions ────────

async function handleGuideDirect(
  projectId: string,
  sb: ReturnType<typeof getServiceClient>,
) {
  // Load guide questions
  const { data: guideQuestions } = await sb
    .from('ia_guide_questions')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');

  if (!guideQuestions?.length) {
    return NextResponse.json({ error: 'No guide questions found' }, { status: 400 });
  }

  // Clear existing canonical questions and dependent data
  const { data: existingCanonicals } = await sb
    .from('ia_canonical_questions')
    .select('id')
    .eq('project_id', projectId);

  if (existingCanonicals?.length) {
    const ids = existingCanonicals.map(c => c.id);
    await sb.from('ia_question_mappings').delete().in('canonical_question_id', ids);
    await sb.from('ia_answers').delete().in('canonical_question_id', ids);
    await sb.from('ia_question_summaries').delete().in('canonical_question_id', ids);
    await sb.from('ia_canonical_questions').delete().eq('project_id', projectId);
  }

  // Create one canonical per guide question — deterministic, no GPT
  const results = [];
  for (let i = 0; i < guideQuestions.length; i++) {
    const gq = guideQuestions[i];
    const { data: inserted } = await sb
      .from('ia_canonical_questions')
      .insert({
        project_id: projectId,
        canonical_text: gq.question_text,
        topic_area: gq.topic_area,
        sort_order: i,
        guide_question_id: gq.id,
      })
      .select()
      .single();

    if (inserted) {
      results.push(inserted);
    }
  }

  return NextResponse.json({
    canonical_questions: results,
    guide_direct: true,
  });
}

// ── INCREMENTAL MATCHING ───────────────────────────────────────────────────────

async function handleIncremental(
  projectId: string,
  interviewIds: string[],
  sb: ReturnType<typeof getServiceClient>,
  openai: ReturnType<typeof getOpenAIClient>,
) {
  // 1. Load existing canonical questions
  const { data: existingCanonicals } = await sb
    .from('ia_canonical_questions')
    .select('id, canonical_text, topic_area, sort_order')
    .eq('project_id', projectId)
    .order('sort_order');

  if (!existingCanonicals?.length) {
    return NextResponse.json({ error: 'No existing canonicals — use full mode' }, { status: 400 });
  }

  // 2. Load only NEW questions (from the specified interviews)
  const { data: newQuestions } = await sb
    .from('ia_questions')
    .select('*')
    .in('interview_id', interviewIds)
    .order('created_at');

  if (!newQuestions?.length) {
    // No new questions extracted — nothing to match
    return NextResponse.json({ canonical_questions: existingCanonicals.map(c => ({ ...c, mapping_count: 0 })) });
  }

  // Load interview names for context
  const { data: interviews } = await sb
    .from('ia_interviews')
    .select('id, name')
    .in('id', interviewIds);
  const interviewMap = new Map((interviews ?? []).map(i => [i.id, i.name]));

  const groupedNewQuestions = newQuestions.map(q => ({
    id: q.id,
    interview: interviewMap.get(q.interview_id) || q.interview_id,
    original: q.original_text,
    normalized: q.normalized_text,
    topic: q.topic,
    is_followup: q.is_followup,
  }));

  // 3. Build incremental GPT prompt
  const existingForGPT = existingCanonicals.map(c => ({
    id: c.id,
    text: c.canonical_text,
    topic: c.topic_area,
  }));

  const validNewQuestionIds = new Set(newQuestions.map(q => q.id));
  const validCanonicalIds = new Set(existingCanonicals.map(c => c.id));

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Du bist ein Experte für qualitative Forschungsmethodik. Du erhältst:
1. BESTEHENDE kanonische Fragen (bereits aus früheren Interviews identifiziert)
2. NEUE extrahierte Fragen aus einem neuen Interview

Deine Aufgabe: Ordne jede NEUE Frage einer BESTEHENDEN kanonischen Frage zu, ODER erstelle neue kanonische Fragen NUR für Themen, die in den bestehenden Fragen noch NICHT abgedeckt sind.

Gib die Ergebnisse als JSON zurück:
{
  "existing_mappings": [
    {
      "canonical_id": "uuid-der-bestehenden-kanonischen-frage",
      "question_ids": ["new-q-id1", "new-q-id2"],
      "similarities": [0.92, 0.85]
    }
  ],
  "new_canonical_questions": [
    {
      "canonical_text": "Neue kanonische Frage für ein bisher nicht abgedecktes Thema",
      "topic_area": "Themengebiet",
      "question_ids": ["new-q-id3"],
      "similarities": [0.90]
    }
  ]
}

Regeln:
- BEVORZUGE die Zuordnung zu bestehenden kanonischen Fragen — erstelle neue NUR wenn das Thema wirklich neu ist
- Similarity-Wert (0-1): 0.5+ reicht für thematische Zuordnung
- Jede neue Frage muss genau EINER Frage zugeordnet werden (bestehend oder neu)
- Die canonical_id MUSS exakt einer der übergebenen bestehenden IDs entsprechen
- Die question_ids MÜSSEN exakt den übergebenen neuen Fragen-IDs entsprechen — keine eigenen IDs erfinden
- Follow-up-Fragen zum selben Thema gehören zur übergeordneten kanonischen Frage`
      },
      {
        role: 'user',
        content: `Bestehende kanonische Fragen:\n${JSON.stringify(existingForGPT, null, 2)}\n\nNeue extrahierte Fragen:\n${JSON.stringify(groupedNewQuestions, null, 2)}`
      }
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: 'No response from GPT' }, { status: 500 });
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'Failed to parse GPT response' }, { status: 500 });
  }

  // 4. Insert mappings to existing canonicals
  const existingMappings: Array<{ canonical_id: string; question_ids: string[]; similarities: number[] }> =
    parsed.existing_mappings ?? [];
  let mappedCount = 0;

  for (const em of existingMappings) {
    if (!validCanonicalIds.has(em.canonical_id)) continue;

    const questionIds: string[] = em.question_ids ?? [];
    const similarities: number[] = em.similarities ?? [];
    const mappings = questionIds
      .map((qId, j) => ({
        canonical_question_id: em.canonical_id,
        question_id: qId,
        similarity: similarities[j] ?? null,
      }))
      .filter(m => validNewQuestionIds.has(m.question_id));

    if (mappings.length > 0) {
      await sb.from('ia_question_mappings').insert(mappings);
      mappedCount += mappings.length;
    }
  }

  // 5. Insert new canonical questions + their mappings
  const newCanonicals: Array<{ canonical_text: string; topic_area?: string; question_ids: string[]; similarities: number[] }> =
    parsed.new_canonical_questions ?? [];
  const maxSortOrder = Math.max(...existingCanonicals.map(c => c.sort_order), -1);
  const newCanonicalResults = [];

  for (let i = 0; i < newCanonicals.length; i++) {
    const cq = newCanonicals[i];
    const { data: inserted } = await sb
      .from('ia_canonical_questions')
      .insert({
        project_id: projectId,
        canonical_text: cq.canonical_text,
        topic_area: cq.topic_area || null,
        sort_order: maxSortOrder + 1 + i,
        guide_question_id: null,
      })
      .select()
      .single();

    if (!inserted) continue;

    const questionIds: string[] = cq.question_ids ?? [];
    const similarities: number[] = cq.similarities ?? [];
    const mappings = questionIds
      .map((qId, j) => ({
        canonical_question_id: inserted.id,
        question_id: qId,
        similarity: similarities[j] ?? null,
      }))
      .filter(m => validNewQuestionIds.has(m.question_id));

    if (mappings.length > 0) {
      await sb.from('ia_question_mappings').insert(mappings);
    }

    newCanonicalResults.push({ ...inserted, mapping_count: mappings.length });
  }

  // Return all canonicals (existing + new)
  const allCanonicals = [
    ...existingCanonicals.map(c => ({ ...c, mapping_count: 0 })),
    ...newCanonicalResults,
  ];

  return NextResponse.json({
    canonical_questions: allCanonicals,
    incremental: true,
    mapped_to_existing: mappedCount,
    new_canonicals_created: newCanonicalResults.length,
  });
}
