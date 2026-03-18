'use client';

import { useState, useCallback, useRef } from 'react';
import { useSupabaseChannel, type RealtimeEventType } from '@/lib/hooks/sync/useSupabaseChannel';
import type { Idea, IdeaConnection } from '@/types';

/**
 * Subscribes to ideas and idea connections via Supabase Realtime.
 * Handles INSERT, UPDATE, and DELETE events for both tables.
 */
export function useRealtimeIdeas(sessionId: string | null) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [connections, setConnections] = useState<IdeaConnection[]>([]);
  const seenIdeaIdsRef = useRef<Set<string>>(new Set());
  const seenConnIdsRef = useRef<Set<string>>(new Set());

  // --- Ideas subscription ---
  const onIdeaPayload = useCallback((row: Idea, eventType: RealtimeEventType) => {
    if (eventType === 'INSERT') {
      if (seenIdeaIdsRef.current.has(row.id)) return;
      seenIdeaIdsRef.current.add(row.id);
      setIdeas((prev) => [...prev, row]);
    } else if (eventType === 'UPDATE') {
      setIdeas((prev) => prev.map((i) => (i.id === row.id ? row : i)));
    } else if (eventType === 'DELETE') {
      setIdeas((prev) => prev.filter((i) => i.id !== row.id));
      seenIdeaIdsRef.current.delete(row.id);
    }
  }, []);

  useSupabaseChannel<Idea>({
    channelName: 'rt-ideas',
    table: 'ideas',
    sessionId,
    isActive: !!sessionId,
    event: '*',
    onPayload: onIdeaPayload,
  });

  // --- Connections subscription ---
  const onConnectionPayload = useCallback((row: IdeaConnection, eventType: RealtimeEventType) => {
    if (eventType === 'INSERT') {
      if (seenConnIdsRef.current.has(row.id)) return;
      seenConnIdsRef.current.add(row.id);
      setConnections((prev) => [...prev, row]);
    } else if (eventType === 'UPDATE') {
      setConnections((prev) => prev.map((c) => (c.id === row.id ? row : c)));
    } else if (eventType === 'DELETE') {
      setConnections((prev) => prev.filter((c) => c.id !== row.id));
      seenConnIdsRef.current.delete(row.id);
    }
  }, []);

  useSupabaseChannel<IdeaConnection>({
    channelName: 'rt-connections',
    table: 'idea_connections',
    sessionId,
    isActive: !!sessionId,
    event: '*',
    onPayload: onConnectionPayload,
  });

  return { ideas, connections };
}
