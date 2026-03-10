import { useCallback } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { useSupabaseChannel, RealtimeEventType } from '@/lib/hooks/sync/useSupabaseChannel';
import { ideaRowToApp } from '@/lib/supabase/converters';
import { Idea } from '@/lib/types';
import type { Database } from '@/lib/supabase/types';

type IdeaRow = Database['public']['Tables']['ideas']['Row'];

interface UseRealtimeIdeasParams {
  sessionId: string | null;
  isActive: boolean;
  addIdea: (idea: Idea) => void;
  updateIdea: (id: string, updates: Partial<Idea>) => void;
}

/**
 * Subscribes to both INSERT and UPDATE events on the ideas table.
 * Uses the generic useSupabaseChannel with event='*' and dispatches
 * to addIdea or updateIdea based on the eventType.
 */
export function useRealtimeIdeas({
  sessionId,
  isActive,
  addIdea,
  updateIdea,
}: UseRealtimeIdeasParams) {
  const addIdeaRef = useLatestRef(addIdea);
  const updateIdeaRef = useLatestRef(updateIdea);

  const onPayload = useCallback((row: IdeaRow, eventType: RealtimeEventType) => {
    if (eventType === 'INSERT') {
      const idea = ideaRowToApp(row);
      addIdeaRef.current(idea);
    } else if (eventType === 'UPDATE') {
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
    }
  }, []);

  useSupabaseChannel<IdeaRow>({
    channelName: 'ideas',
    table: 'ideas',
    sessionId,
    isActive,
    event: '*',
    onPayload,
  });
}
