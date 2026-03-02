import OpenAI from "openai";

export async function GET() {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const models = await openai.models.list();

    return Response.json({ ok: true, models: models.data.slice(0, 5) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ ok: false, error: message });
  }
}

