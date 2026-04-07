import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';

export const maxDuration = 60;

function buildParseGuidePrompt(isEn: boolean): string {
  if (isEn) {
    return `You are an expert in qualitative research methodology. You receive the raw text of an interview guide. It may be unstructured: mixed numbering, category headers, sub-questions, notes, etc.

Your task: Extract all concrete interview questions and organize them with topic areas.

Return results as JSON:
{
  "questions": [
    {
      "question_text": "The cleaned, complete question",
      "topic_area": "Overarching topic area / category"
    }
  ]
}

Rules:
- Detect categories/headers and use them as topic_area for the questions below them
- If no categories are visible, derive meaningful topic_areas from the content
- Preserve the original order
- Remove numbering, bullet points, indentation from question text
- Only split combined questions if they clearly address independent topics
- Keep questions that cover multiple aspects of ONE topic as a single question
- Notes, instructions for the interviewer (e.g., "If yes, probe:") are NOT separate questions
- Follow-up prompts ("If yes: ...") CAN be extracted as questions if they are substantive standalone questions
- Return questions in the ORIGINAL language (do not translate)
- If the guide only has topic headers without actual questions, extract implied questions from those topics (e.g., header "Work-life balance" → "How do you experience your work-life balance?")
- Aim for 5-30 questions. If more than 30, merge sub-questions that overlap thematically

EXAMPLE:
Input: "1. Einstieg\\n  a) Erzählen Sie kurz von sich\\n  b) Was machen Sie beruflich?\\n2. Hauptteil\\n  Wie erleben Sie die Zusammenarbeit im Team?\\n  (Nachfragen: Konflikte? Kommunikation?)\\n3. Abschluss\\n  Gibt es noch etwas, das Sie ergänzen möchten?"
Output: {"questions": [{"question_text": "Erzählen Sie kurz von sich", "topic_area": "Einstieg"}, {"question_text": "Was machen Sie beruflich?", "topic_area": "Einstieg"}, {"question_text": "Wie erleben Sie die Zusammenarbeit im Team?", "topic_area": "Hauptteil"}, {"question_text": "Gibt es noch etwas, das Sie ergänzen möchten?", "topic_area": "Abschluss"}]}`;
  }
  return `Du bist ein Experte für qualitative Forschungsmethodik. Du erhältst den rohen Text eines Interview-Leitfadens. Dieser kann unstrukturiert sein: verschiedene Nummerierungen, Kategorien-Überschriften, Unterfragen, Notizen, etc.

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
- Gib die Fragen in der Sprache des Originals zurück (nicht übersetzen)
- Wenn der Leitfaden nur Themen-Überschriften ohne echte Fragen enthält, leite implizierte Fragen daraus ab (z.B. Überschrift "Work-Life-Balance" → "Wie erleben Sie Ihre Work-Life-Balance?")
- Ziele auf 5-30 Fragen. Bei mehr als 30: Unterfragen zusammenführen, die sich thematisch überschneiden

BEISPIEL:
Input: "1. Einstieg\\n  a) Erzählen Sie kurz von sich\\n  b) Was machen Sie beruflich?\\n2. Hauptteil\\n  Wie erleben Sie die Zusammenarbeit im Team?\\n  (Nachfragen: Konflikte? Kommunikation?)\\n3. Abschluss\\n  Gibt es noch etwas, das Sie ergänzen möchten?"
Output: {"questions": [{"question_text": "Erzählen Sie kurz von sich", "topic_area": "Einstieg"}, {"question_text": "Was machen Sie beruflich?", "topic_area": "Einstieg"}, {"question_text": "Wie erleben Sie die Zusammenarbeit im Team?", "topic_area": "Hauptteil"}, {"question_text": "Gibt es noch etwas, das Sie ergänzen möchten?", "topic_area": "Abschluss"}]}`;
}

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

  // Load project language
  const { data: project } = await sb
    .from('ia_projects')
    .select('language')
    .eq('id', projectId)
    .single();
  const isEn = (project?.language ?? 'de') === 'en';

  const response = await openai.chat.completions.create({
    model: 'gpt-5.4',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildParseGuidePrompt(isEn) },
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
