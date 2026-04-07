import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';

export const maxDuration = 30;

type Params = { params: Promise<{ projectId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json();
  const { text } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
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

  // Load existing codebook
  const { data: codes } = await sb
    .from('ia_codes')
    .select('id, name, description, parent_id')
    .eq('project_id', projectId)
    .order('sort_order');

  const codebookContext = (codes ?? []).map(c => {
    const parent = c.parent_id ? codes?.find(p => p.id === c.parent_id)?.name : null;
    return `- ${parent ? parent + ' > ' : ''}${c.name}${c.description ? ` (${c.description})` : ''}`;
  }).join('\n');

  const systemPrompt = isEn
    ? `You are an expert qualitative research coding assistant using open coding methodology. Given a text passage and an existing codebook, suggest 3-5 relevant codes.

CODING PRINCIPLES:
- Codes should be short noun phrases or gerunds (2-4 words), e.g., "Technology frustration", "Team collaboration", "Learning motivation"
- BAD codes: full sentences, vague labels like "Miscellaneous", or overly broad terms like "Experience"
- If an existing code fits, reference it EXACTLY by name
- If a parent code exists that could contain a more specific sub-code, suggest the sub-code with the parent noted
- Avoid suggesting codes that overlap semantically — each code should capture a DISTINCT concept
- Prioritize existing codes over creating new ones

Return JSON: { "suggestions": [{ "name": "CodeName", "is_existing": true/false, "parent": "ParentCodeName or null" }] }
Only return valid JSON, nothing else.`
    : `Du bist ein Experte für qualitatives Kodieren nach der Open-Coding-Methodik. Gegeben ein Textausschnitt und ein bestehendes Codebuch, schlage 3-5 passende Codes vor.

KODIER-PRINZIPIEN:
- Codes sollen kurze Nominalphrasen sein (2-4 Wörter), z.B. "Frustration mit Technik", "Teamzusammenarbeit", "Lernmotivation"
- SCHLECHTE Codes: ganze Sätze, vage Labels wie "Sonstiges", oder zu breite Begriffe wie "Erfahrung"
- Wenn ein bestehender Code passt, nenne ihn EXAKT beim Namen
- Wenn ein Eltern-Code existiert, der einen spezifischeren Sub-Code enthalten könnte, schlage den Sub-Code mit Verweis auf den Eltern-Code vor
- Vermeide semantisch überlappende Codes — jeder Code soll ein EIGENES Konzept erfassen
- Bevorzuge bestehende Codes gegenüber neuen

Gib JSON zurück: { "suggestions": [{ "name": "CodeName", "is_existing": true/false, "parent": "ElternCodeName oder null" }] }
Gib nur valides JSON zurück, sonst nichts.`;

  const userContent = isEn
    ? `Text passage:\n"${text}"\n\nExisting codebook:\n${codebookContext || '(empty)'}`
    : `Textausschnitt:\n"${text}"\n\nBestehendes Codebuch:\n${codebookContext || '(leer)'}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    const parsed = JSON.parse(content);
    const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).map(
      (s: { name: string; is_existing?: boolean }) => {
        const match = (codes ?? []).find(c => c.name.toLowerCase() === s.name.toLowerCase());
        return {
          name: s.name,
          existing_code_id: match?.id ?? null,
        };
      }
    );

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
