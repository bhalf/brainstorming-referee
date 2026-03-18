import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

// POST — Log a session event
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, eventType, payload, actor, timestamp } = body;

        if (!sessionId || !eventType) {
            return NextResponse.json({ error: 'sessionId and eventType required' }, { status: 400 });
        }

        const supabase = getServiceClient();

        const { error } = await supabase
            .from('session_events')
            .insert({
                session_id: sessionId,
                event_type: eventType,
                payload: payload ?? null,
                actor: actor ?? null,
                timestamp: timestamp || Date.now(),
            });

        if (error) {
            console.error('Failed to insert session event:', error);
            return NextResponse.json({ error: 'Failed to insert event' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Event insert error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// GET — Fetch events for a session
export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
        .from('session_events')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({ events: data || [] });
}
