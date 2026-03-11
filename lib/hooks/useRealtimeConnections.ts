import { useCallback } from 'react';
import { useSupabaseChannel } from '@/lib/hooks/sync/useSupabaseChannel';
import { connectionRowToApp } from '@/lib/supabase/converters';
import { IdeaConnection } from '@/lib/types';
import type { Database } from '@/lib/supabase/types';

type ConnectionRow = Database['public']['Tables']['idea_connections']['Row'];

/** Parameters for the realtime idea connections subscription hook. */
interface UseRealtimeConnectionsParams {
  sessionId: string | null;
  isActive: boolean;
  addConnection: (connection: IdeaConnection) => void;
}

/**
 * Subscribes to new idea connections via Supabase Realtime (INSERT events).
 * Converts database rows to app-level {@link IdeaConnection} objects and
 * dispatches them to the session context.
 *
 * @param params - Session ID, active flag, and connection dispatcher.
 */
export function useRealtimeConnections({
  sessionId,
  isActive,
  addConnection,
}: UseRealtimeConnectionsParams) {
  const onPayload = useCallback((row: ConnectionRow) => {
    const connection = connectionRowToApp(row);
    addConnection(connection);
  }, [addConnection]);

  useSupabaseChannel<ConnectionRow>({
    channelName: 'idea-connections',
    table: 'idea_connections',
    sessionId,
    isActive,
    event: 'INSERT',
    onPayload,
  });
}
