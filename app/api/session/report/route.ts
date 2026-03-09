import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { generateSessionReport, generateLLMSessionSummary } from '@/lib/state/generateSessionReport';

// GET — Get or compute a post-session report
export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const forceRecompute = request.nextUrl.searchParams.get('recompute') === 'true';

    if (!sessionId) {
        return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Check for cached report first (unless force recompute)
    if (!forceRecompute) {
        const { data: session } = await supabase
            .from('sessions')
            .select('report')
            .eq('id', sessionId)
            .single();

        if (session?.report) {
            return NextResponse.json({ report: session.report, cached: true });
        }
    }

    // Fetch all raw data in parallel
    const [sessionRes, segmentsRes, snapshotsRes, interventionsRes, ideasRes, participantsRes] = await Promise.all([
        supabase.from('sessions').select('started_at, ended_at, language').eq('id', sessionId).single(),
        supabase.from('transcript_segments').select('speaker, text, timestamp').eq('session_id', sessionId).order('timestamp'),
        supabase.from('metric_snapshots').select('timestamp, metrics, state_inference').eq('session_id', sessionId).order('timestamp'),
        supabase.from('interventions').select('id, type, trigger, intent, message, timestamp, recovery_result, rule_violated, rule_evidence, rule_severity').eq('session_id', sessionId).order('timestamp'),
        supabase.from('ideas').select('author').eq('session_id', sessionId).eq('is_deleted', false),
        supabase.from('session_participants').select('identity, display_name, role').eq('session_id', sessionId),
    ]);

    if (sessionRes.error || !sessionRes.data) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const session = sessionRes.data;
    const sessionStartedAt = new Date(session.started_at).getTime();
    const sessionEndedAt = session.ended_at ? new Date(session.ended_at).getTime() : null;

    const report = generateSessionReport(
        sessionStartedAt,
        sessionEndedAt,
        segmentsRes.data ?? [],
        snapshotsRes.data ?? [],
        interventionsRes.data ?? [],
        ideasRes.data ?? [],
        participantsRes.data ?? [],
    );

    // Generate LLM narrative summary (best-effort)
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && report.overview.totalSegments > 0) {
        try {
            report.llmSummary = await generateLLMSessionSummary(
                report, session.language ?? 'en-US', apiKey
            );
        } catch { /* non-blocking */ }
    }

    // Cache the report on the session
    await supabase
        .from('sessions')
        .update({ report: report as unknown as Record<string, unknown> })
        .eq('id', sessionId);

    return NextResponse.json({ report, cached: false });
}
