import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const sb = getServiceClient();

  // Get projects with interview count
  const { data: projects, error } = await sb
    .from('ia_projects')
    .select('*, ia_interviews(count)')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (projects ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    interview_count: (p.ia_interviews as Array<{ count: number }>)?.[0]?.count ?? 0,
    ia_interviews: undefined,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, description, language } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from('ia_projects')
    .insert({ name: name.trim(), description: description || null, language: language || 'de' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
