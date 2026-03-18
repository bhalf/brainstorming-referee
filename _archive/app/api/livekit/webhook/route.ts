import { NextRequest, NextResponse } from 'next/server';
import { WebhookReceiver } from 'livekit-server-sdk';
import { getServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/livekit/webhook
 * Receives LiveKit webhook events. The most important one is `room_finished`
 * which fires when a LiveKit room becomes empty — we use it to auto-close
 * the corresponding session.
 *
 * Configure in LiveKit Cloud: https://cloud.livekit.io → Project → Webhooks
 * URL: https://your-domain/api/livekit/webhook
 */
export async function POST(request: NextRequest) {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
        return NextResponse.json({ error: 'LiveKit credentials not configured' }, { status: 503 });
    }

    try {
        const body = await request.text();
        const authHeader = request.headers.get('authorization') || '';

        // Validate webhook signature
        const receiver = new WebhookReceiver(apiKey, apiSecret);
        const event = await receiver.receive(body, authHeader);

        console.log(`[LiveKit Webhook] Event: ${event.event}, Room: ${event.room?.name || 'n/a'}`);

        if (event.event === 'room_finished' && event.room?.name) {
            const roomName = event.room.name;
            const supabase = getServiceClient();
            const now = new Date().toISOString();

            // Find active session for this room
            const { data: session } = await supabase
                .from('sessions')
                .select('id')
                .eq('room_name', roomName)
                .is('ended_at', null)
                .limit(1)
                .single();

            if (session) {
                console.log(`[LiveKit Webhook] Room "${roomName}" finished — closing session ${session.id}`);

                // Mark all participants as left
                await supabase
                    .from('session_participants')
                    .update({ left_at: now })
                    .eq('session_id', session.id)
                    .is('left_at', null);

                // End the session
                await supabase
                    .from('sessions')
                    .update({ ended_at: now })
                    .eq('id', session.id);
            } else {
                console.log(`[LiveKit Webhook] Room "${roomName}" finished but no active session found`);
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[LiveKit Webhook] Error:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
