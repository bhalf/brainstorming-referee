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
  const { interviewId, interviewIds } = body as { interviewId?: string; interviewIds?: string[] };

  const sb = getServiceClient();
  const openai = getOpenAIClient();

  // Load project language
  const { data: project } = await sb
    .from('ia_projects')
    .select('language')
    .eq('id', projectId)
    .single();
  const projectLang = project?.language ?? 'de';
  const isEn = projectLang === 'en';

  // Load interview(s) — supports single ID, array of IDs, or all
  let interviews;
  if (interviewIds?.length) {
    const { data } = await sb
      .from('ia_interviews')
      .select('*')
      .eq('project_id', projectId)
      .in('id', interviewIds)
      .in('status', ['transcribed', 'analyzed']);
    interviews = data ?? [];
  } else if (interviewId) {
    const { data } = await sb
      .from('ia_interviews')
      .select('*')
      .eq('id', interviewId)
      .eq('project_id', projectId)
      .single();
    interviews = data ? [data] : [];
  } else {
    const { data } = await sb
      .from('ia_interviews')
      .select('*')
      .eq('project_id', projectId)
      .in('status', ['transcribed', 'analyzed']);
    interviews = data ?? [];
  }

  if (interviews.length === 0) {
    return NextResponse.json({ error: 'No transcribed interviews found' }, { status: 400 });
  }

  // Load guide questions if they exist (for context)
  const { data: guideQuestions } = await sb
    .from('ia_guide_questions')
    .select('question_text, topic_area')
    .eq('project_id', projectId)
    .order('sort_order');

  const defaultTopic = isEn ? 'General' : 'Allgemein';
  const guideContext = guideQuestions?.length
    ? isEn
      ? `\n\nThe interview guide contains the following planned questions (actual questions may be worded differently):\n${guideQuestions.map((g, i) => `${i + 1}. [${g.topic_area || defaultTopic}] ${g.question_text}`).join('\n')}\n\nUse this guide as orientation to better recognize questions in the transcript — even if they are worded differently.`
      : `\n\nDer Interview-Leitfaden enthält folgende geplante Fragen (die tatsächlich gestellten Fragen können anders formuliert sein):\n${guideQuestions.map((g, i) => `${i + 1}. [${g.topic_area || defaultTopic}] ${g.question_text}`).join('\n')}\n\nNutze diesen Leitfaden als Orientierung, um Fragen im Transkript besser zu erkennen — auch wenn sie anders formuliert sind.`
    : '';

  const results = [];

  for (const interview of interviews) {
    if (!interview.transcript_text) continue;

    // Delete existing questions for this interview (re-extraction)
    await sb.from('ia_questions').delete().eq('interview_id', interview.id);

    const response = await openai.chat.completions.create({
      model: 'gpt-5.4',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: isEn
            ? `You are an expert in qualitative research methodology. Analyze the following interview transcript and identify all instances where the interviewer asks a question or introduces a new topic.

SPEAKER DETECTION:
- The transcript MAY contain speaker labels (e.g. "Interviewer:", "Participant:", "I:", "P:", "Name:"). If so, use them.
- If NO speaker labels: Recognize interviewer questions by context — shorter passages with question marks, prompts, or topic changes are typically from the interviewer. Longer narrative passages are answers.

Return results as JSON:
{
  "questions": [
    {
      "original": "The exact wording of the question from the transcript",
      "normalized": "A standardized version of the question (max 15 words)",
      "topic": "Core topic in 2-3 words",
      "is_followup": false,
      "followup_to_index": null
    }
  ]
}

Rules:
- Detect both direct questions and thematic introductions ("Tell me about...", "When you think of X...", "How do you see...")
- Interviewer interjections like "mhm", "I see", "right" are NOT separate questions
- "and then?" / "go on?" are follow-ups (is_followup=true), NOT standalone questions
- Clarification questions from the INTERVIEWEE (e.g. "Do you mean...?") are NOT interviewer questions
- For follow-ups: set is_followup=true and followup_to_index to the index of the parent question
- Detect questions in the order they appear in the transcript
- Better to extract one question TOO MANY than too few — when in doubt, include it
- If no questions are found, return an empty array: {"questions": []}`
            : `Du bist ein Experte für qualitative Forschungsmethodik. Analysiere das folgende Interview-Transkript und identifiziere alle Stellen, an denen der/die Interviewer:in eine Frage stellt oder ein neues Thema einleitet.

SPEAKER-ERKENNUNG:
- Das Transkript KANN Speaker-Labels enthalten (z.B. "Interviewer:", "Teilnehmer:", "I:", "B:", "Name:"). Falls ja, nutze diese.
- Falls KEINE Speaker-Labels vorhanden: Erkenne Interviewer-Fragen am Kontext — kürzere Passagen mit Fragezeichen, Aufforderungen oder Themenwechsel sind typischerweise vom Interviewer. Längere narrative Passagen sind Antworten.

Gib die Ergebnisse als JSON zurück:
{
  "questions": [
    {
      "original": "Der exakte Wortlaut der Frage aus dem Transkript",
      "normalized": "Eine standardisierte Version der Frage (max 15 Wörter)",
      "topic": "Kernthema in 2-3 Wörtern",
      "is_followup": false,
      "followup_to_index": null
    }
  ]
}

Regeln:
- Erkenne sowohl direkte Fragen als auch thematische Einleitungen ("Erzählen Sie mir von...", "Wenn Sie an X denken...", "Wie sehen Sie das mit...")
- Interviewer-Einwürfe wie "mhm", "verstehe", "ja genau" sind KEINE eigenen Fragen
- "und dann?" / "und weiter?" sind Nachfragen (is_followup=true), NICHT eigenständige Fragen
- Rückfragen der BEFRAGTEN (z.B. "Meinen Sie damit...?") sind KEINE Interviewer-Fragen
- Bei Nachfragen: setze is_followup=true und followup_to_index auf den Index der übergeordneten Frage
- Erkenne die Fragen in der Reihenfolge ihres Auftretens im Transkript
- Lieber eine Frage ZU VIEL extrahieren als eine zu wenig — im Zweifel aufnehmen
- Wenn keine Fragen erkennbar sind, gib ein leeres Array zurück: {"questions": []}`
        },
        {
          role: 'user',
          content: `Interview: "${interview.name}"${guideContext}\n\nTranskript:\n${interview.transcript_text}`
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

    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const insertData = questions.map((q: {
      original: string;
      normalized: string;
      topic?: string;
      is_followup?: boolean;
    }, _idx: number) => ({
      interview_id: interview.id,
      original_text: q.original,
      normalized_text: q.normalized,
      topic: q.topic || null,
      is_followup: q.is_followup || false,
    }));

    if (insertData.length > 0) {
      const { data } = await sb.from('ia_questions').insert(insertData).select();
      results.push({ interview_id: interview.id, questions: data ?? [] });

      // Handle follow-up parent linking
      if (data) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (q.is_followup && q.followup_to_index != null && q.followup_to_index < data.length) {
            await sb
              .from('ia_questions')
              .update({ parent_question_id: data[q.followup_to_index].id })
              .eq('id', data[i].id);
          }
        }
      }
    }
  }

  return NextResponse.json({ results });
}
