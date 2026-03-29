import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const sb = getServiceClient();

  const { data, error } = await sb
    .from('ia_codes')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json();
  const { name, parent_id, description, color } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const sb = getServiceClient();

  // Auto sort_order: max within same parent + 1
  let query = sb
    .from('ia_codes')
    .select('sort_order')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (parent_id) {
    query = query.eq('parent_id', parent_id);
  } else {
    query = query.is('parent_id', null);
  }

  const { data: siblings } = await query;
  const nextOrder = ((siblings?.[0]?.sort_order ?? -1) + 1);

  const { data, error } = await sb
    .from('ia_codes')
    .insert({
      project_id: projectId,
      parent_id: parent_id || null,
      name: name.trim(),
      description: description || null,
      color: color || '#6366F1',
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json();
  const { id, ...fields } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const sb = getServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) updates.name = fields.name;
  if (fields.parent_id !== undefined) updates.parent_id = fields.parent_id || null;
  if (fields.description !== undefined) updates.description = fields.description;
  if (fields.color !== undefined) updates.color = fields.color;
  if (fields.sort_order !== undefined) updates.sort_order = fields.sort_order;

  const { data, error } = await sb
    .from('ia_codes')
    .update(updates)
    .eq('id', id)
    .eq('project_id', projectId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const sb = getServiceClient();
  const { error } = await sb
    .from('ia_codes')
    .delete()
    .eq('id', id)
    .eq('project_id', projectId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
