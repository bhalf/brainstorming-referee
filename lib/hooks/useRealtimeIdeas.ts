import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ideaRowToApp } from '@/lib/supabase/converters';
import { Idea } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type IdeaRow = Database['public']['Tables']['ideas']['Row'];

interface UseRealtimeIdeasParams {
  sessionId: string | null;
  isActive: boolean;
  addIdea: (idea: Idea) => void;
  updateIdea: (id: string, updates: Partial<Idea>) => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

/**
 * Subscribes to both INSERT and UPDATE events on the ideas table.
 * Cannot use the generic useSupabaseChannel since it needs dual event handlers.
 */
export function useRealtimeIdeas({
  sessionId,
  isActive,
  addIdea,
  updateIdea,
}: UseRealtimeIdeasParams) {
  const addIdeaRef = useRef(addIdea);
  useEffect(() => { addIdeaRef.current = addIdea; }, [addIdea]);

  const updateIdeaRef = useRef(updateIdea);
  useEffect(() => { updateIdeaRef.current = updateIdea; }, [updateIdea]);

  const reconnectAttemptsRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const subscribeRef = useRef<((sid: string) => void) | null>(null);

  const subscribe = useCallback((sid: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`ideas-${sid}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'ideas',
        filter: `session_id=eq.${sid}`,
      }, (payload) => {
        const idea = ideaRowToApp(payload.new as IdeaRow);
        addIdeaRef.current(idea);
        reconnectAttemptsRef.current = 0;
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ideas',
        filter: `session_id=eq.${sid}`,
      }, (payload) => {
        const row = payload.new as IdeaRow;
        updateIdeaRef.current(row.id, {
          positionX: row.position_x,
          positionY: row.position_y,
          color: row.color,
          isDeleted: row.is_deleted,
          title: row.title,
          description: row.description ?? null,
          updatedAt: new Date(row.updated_at).getTime(),
          ideaType: (row.idea_type as Idea['ideaType']) || 'idea',
          parentId: row.parent_id ?? null,
        });
        reconnectAttemptsRef.current = 0;
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0;
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isMountedRef.current) {
          console.error(`Realtime ideas error (${status}):`, err);
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current);
            reconnectAttemptsRef.current++;
            setTimeout(() => {
              if (isMountedRef.current && subscribeRef.current) subscribeRef.current(sid);
            }, delay);
          }
        }
      });

    channelRef.current = channel;
  }, []);

  useEffect(() => { subscribeRef.current = subscribe; }, [subscribe]);

  useEffect(() => {
    if (!sessionId || !isActive) return;
    isMountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    subscribe(sessionId);

    return () => {
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, isActive, subscribe]);
}
