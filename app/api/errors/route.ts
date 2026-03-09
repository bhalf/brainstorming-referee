import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

// POST — Log a session error
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, timestamp, message, context } = body;

        if (!sessionId || !message) {
            return NextResponse.json({ error: 'sessionId and message required' }, { status: 400 });
        }

        const supabase = getServiceClient();

        const { error } = await supabase
            .from('session_errors')
            .insert({
                session_id: sessionId,
                timestamp: timestamp || Date.now(),
                message,
                context: context ?? null,
            });

        if (error) {
            console.error('Failed to insert session error:', error);
            return NextResponse.json({ error: 'Failed to insert error' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error insert error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// GET — Fetch errors for a session
export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    const { data, error } = await supabase
        .from('session_errors')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch errors' }, { status: 500 });
    }

    return NextResponse.json({ errors: data || [] });
}
