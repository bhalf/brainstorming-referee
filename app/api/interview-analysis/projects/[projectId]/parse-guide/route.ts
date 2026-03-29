import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';

export const maxDuration = 60;

const PARSE_GUIDE_PROMPT = `Du bist ein Experte für qualitative Forschungsmethodik. Du erhältst den rohen Text eines Interview-Leitfadens. Dieser kann unstrukturiert sein: verschiedene Nummerierungen, Kategorien-Überschriften, Unterfragen, Notizen, etc.

Deine Aufgabe: Extrahiere alle konkreten Interviewfragen und organisiere sie mit Themengebieten.

Gib die Ergebnisse als JSON zurück:
{
  "questions": [
    {
      "question_text": "Die bereinigte, vollständige Frage",
      "topic_area": "Übergeordnetes Themengebiet / Kategorie"
    }
  ]
}

Regeln:
- Erkenne Kategorien/Überschriften und nutze sie als topic_area für die darunter stehenden Fragen
- Wenn keine Kategorien erkennbar sind, leite sinnvolle topic_areas aus dem Inhalt ab
- Behalte die Reihenfolge des Originals bei
- Entferne Nummerierungen, Aufzählungszeichen, Einrückungen aus dem Fragentext
- Trenne zusammengefasste Fragen nur, wenn sie klar unabhängige Themen ansprechen
- Belasse Fragen, die mehrere Aspekte eines Themas abdecken, als eine Frage
- Notizen, Anweisungen an den Interviewer (z.B. "Falls ja, nachfragen:") werden NICHT als eigene Frage erfasst
- Nachfrage-Hinweise ("Wenn ja: ...") können als eigene Frage erfasst werden, wenn sie eine eigenständige Frage darstellen
- Gib die Fragen in der Sprache des Originals zurück (nicht übersetzen)`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { raw_text } = await req.json();

  if (!raw_text?.trim()) {
    return NextResponse.json({ error: 'Text ist erforderlich' }, { status: 400 });
  }

  const sb = getServiceClient();
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: 'gpt-5.4',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: PARSE_GUIDE_PROMPT },
      { role: 'user', content: raw_text },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: 'Keine Antwort von GPT' }, { status: 500 });
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'GPT-Antwort konnte nicht geparst werden' }, { status: 500 });
  }

  if (!Array.isArray(parsed.questions)) {
    return NextResponse.json({ error: 'Unexpected LLM response format: missing questions array' }, { status: 500 });
  }
  const questions: Array<{ question_text: string; topic_area?: string }> = parsed.questions;

  // Delete existing guide questions
  await sb.from('ia_guide_questions').delete().eq('project_id', projectId);

  // Insert new guide questions
  const insertData = questions.map((q, i) => ({
    project_id: projectId,
    question_text: q.question_text,
    topic_area: q.topic_area || null,
    sort_order: i,
  }));

  const { data, error } = await sb.from('ia_guide_questions').insert(insertData).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Save raw text on project
  await sb.from('ia_projects').update({ guide_raw_text: raw_text }).eq('id', projectId);

  return NextResponse.json(data ?? []);
}
