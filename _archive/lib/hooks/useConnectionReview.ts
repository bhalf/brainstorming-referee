/**
 * Periodic connection review hook.
 *
 * Every 45 seconds, sends ALL ideas and connections to the connection review
 * LLM endpoint, which returns add/remove/update operations. Results are applied
 * to the local state and persisted to the backend.
 * @module
 */

import { useEffect, useRef } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { Idea, IdeaConnection, IdeaConnectionType, ModelRoutingLogEntry } from '@/lib/types';
import { persistConnection, deleteConnection, updateConnectionApi } from '@/lib/services/ideaService';
import { apiPost } from '@/lib/services/apiClient';

const REVIEW_INTERVAL_MS = 45_000;
const MIN_IDEAS_FOR_REVIEW = 5;

interface UseConnectionReviewParams {
  isActive: boolean;
  isDecisionOwner: boolean;
  sessionId: string | null;
  ideas: Idea[];
  connections: IdeaConnection[];
  language: string;
  addIdeaConnection: (connection: IdeaConnection) => void;
  removeIdeaConnection: (id: string) => void;
  updateIdeaConnection: (id: string, updates: Partial<IdeaConnection>) => void;
  addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
}

/**
 * Compute a simple hash of idea IDs + connection IDs to detect changes.
 */
function computeHash(ideas: Idea[], connections: IdeaConnection[]): string {
  const ideaPart = ideas.map(i => i.id).sort().join(',');
  const connPart = connections.map(c => c.id).sort().join(',');
  return `${ideaPart}|${connPart}`;
}

/**
 * Periodically reviews all idea connections using an LLM endpoint.
 * Only runs on the decision owner to avoid duplicate calls.
 */
export function useConnectionReview({
  isActive,
  isDecisionOwner,
  sessionId,
  ideas,
  connections,
  language,
  addIdeaConnection,
  removeIdeaConnection,
  updateIdeaConnection,
  addModelRoutingLog,
}: UseConnectionReviewParams) {
  const sessionIdRef = useLatestRef(sessionId);
  const ideasRef = useLatestRef(ideas);
  const connectionsRef = useLatestRef(connections);
  const lastReviewedHashRef = useRef<string>('');
  const isReviewingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isActive || !isDecisionOwner) return;

    const interval = setInterval(async () => {
      if (isReviewingRef.current) return;

      const currentIdeas = ideasRef.current.filter(i => !i.isDeleted);
      const currentConnections = connectionsRef.current;

      if (currentIdeas.length < MIN_IDEAS_FOR_REVIEW) return;

      // Skip if nothing changed since last review
      const hash = computeHash(currentIdeas, currentConnections);
      if (hash === lastReviewedHashRef.current) return;

      isReviewingRef.current = true;

      // Abort previous in-flight review
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const sid = sessionIdRef.current;

        // Build id→title map for connection titles
        const idToTitle = new Map(currentIdeas.map(i => [i.id, i.title]));

        const requestBody = {
          ideas: currentIdeas.map(i => ({
            id: i.id,
            title: i.title,
            description: i.description,
            ideaType: i.ideaType || 'idea',
          })),
          existingConnections: currentConnections.map(c => ({
            id: c.id,
            sourceId: c.sourceIdeaId,
            sourceTitle: idToTitle.get(c.sourceIdeaId) || c.sourceIdeaId,
            targetId: c.targetIdeaId,
            targetTitle: idToTitle.get(c.targetIdeaId) || c.targetIdeaId,
            type: c.connectionType,
          })),
          language,
        };

        console.log(`[ConnectionReview] Starting review: ${currentIdeas.length} ideas, ${currentConnections.length} connections`);

        const data = await apiPost<{
          add?: Array<{ sourceId: string; targetId: string; type: string; label?: string | null }>;
          remove?: string[];
          update?: Array<{ id: string; type: string; label?: string | null }>;
          logEntry?: Record<string, unknown>;
        }>('/api/ideas/review-connections', requestBody, {
          signal: controller.signal,
          maxRetries: 0,
        });

        if (data.logEntry) {
          addModelRoutingLog(data.logEntry as unknown as ModelRoutingLogEntry);
        }

        // Apply additions
        if (data.add && Array.isArray(data.add)) {
          for (const addition of data.add) {
            const connection: IdeaConnection = {
              id: `conn-${crypto.randomUUID()}`,
              sessionId: sid || '',
              sourceIdeaId: addition.sourceId,
              targetIdeaId: addition.targetId,
              label: addition.label || null,
              connectionType: addition.type as IdeaConnectionType,
              createdAt: Date.now(),
            };
            console.log('[ConnectionReview] Adding connection:', idToTitle.get(addition.sourceId), '→', idToTitle.get(addition.targetId), `(${addition.type})`);
            addIdeaConnection(connection);
            if (sid) persistConnection(sid, connection);
          }
        }

        // Apply removals
        if (data.remove && Array.isArray(data.remove)) {
          for (const connId of data.remove) {
            console.log('[ConnectionReview] Removing connection:', connId);
            removeIdeaConnection(connId);
            deleteConnection(connId);
          }
        }

        // Apply updates
        if (data.update && Array.isArray(data.update)) {
          for (const upd of data.update) {
            console.log('[ConnectionReview] Updating connection:', upd.id, '→', upd.type);
            updateIdeaConnection(upd.id, {
              connectionType: upd.type as IdeaConnectionType,
              ...(upd.label !== undefined ? { label: upd.label } : {}),
            });
            updateConnectionApi(upd.id, {
              connectionType: upd.type,
              ...(upd.label !== undefined ? { label: upd.label } : {}),
            });
          }
        }

        lastReviewedHashRef.current = hash;
        console.log('[ConnectionReview] Review complete');
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('[ConnectionReview] Request aborted');
        } else {
          console.error('[ConnectionReview] Error:', error);
        }
      } finally {
        isReviewingRef.current = false;
      }
    }, REVIEW_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isActive, isDecisionOwner, language, addIdeaConnection, removeIdeaConnection, updateIdeaConnection, addModelRoutingLog]);
}
