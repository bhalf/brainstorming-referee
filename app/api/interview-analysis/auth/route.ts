import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const correct = process.env.INTERVIEW_ANALYSIS_PASSWORD;

  if (!correct) {
    return NextResponse.json({ ok: false, error: 'Password not configured' }, { status: 500 });
  }

  return NextResponse.json({ ok: password === correct });
}
