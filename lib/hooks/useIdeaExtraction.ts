import { useEffect, useRef, MutableRefObject } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { TranscriptSegment, Idea, IdeaConnection } from '@/lib/types';
import { persistIdea, persistConnection } from '@/lib/services/ideaService';
import { apiPost } from '@/lib/services/apiClient';
import { EXTRACTION_TICK_MS, STAGGER_EXTRACTION_MS } from '@/lib/decision/tickConfig';

interface UseIdeaExtractionParams {
  isActive: boolean;
  isDecisionOwner: boolean;
  sessionId: string | null;
  transcriptSegmentsRef: MutableRefObject<TranscriptSegment[]>;
  ideas: Idea[];
  language: string;
  addIdea: (idea: Idea) => void;
  addIdeaConnection: (connection: IdeaConnection) => void;
  addModelRoutingLog: (entry: import('@/lib/types').ModelRoutingLogEntry) => void;
  addError: (message: string, context?: string) => void;
}


const MIN_NEW_SEGMENTS_DEFAULT = 2;
const MIN_NEW_SEGMENTS_CATCHUP = 1;
const CATCHUP_THRESHOLD_MS = 10_000;
const STALE_REQUEST_MS = 8_000;
const STAGGER_DELAY_MS = 300;
const CONTEXT_WINDOW_SEGMENTS = 15;

const IDEA_COLORS = [
  'yellow', 'light-green', 'light-blue', 'light-red',
  'light-violet', 'orange', 'blue', 'green',
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function getColorForAuthor(author: string): string {
  return IDEA_COLORS[hashCode(author) % IDEA_COLORS.length];
}

function calculatePosition(existingIdeas: Idea[], index: number, parentIdea?: Idea, ideaId?: string): { x: number; y: number } {
  const CELL_W = 380;  // card width 200 + 180 breathing room
  const CELL_H = 300;
  const MAX_COLS = 4;
  const CANVAS_OFFSET_X = 40;
  const CANVAS_OFFSET_Y = 40;

  // Deterministic jitter based on idea ID so it looks natural but is reproducible
  function jitter(seed: string): { dx: number; dy: number } {
    if (!seed) return { dx: 0, dy: 0 };
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = ((h << 5) - h) + seed.charCodeAt(i);
      h |= 0;
    }
    const dx = ((Math.abs(h) % 31) - 15); // ±15px
    const dy = ((Math.abs(h * 7) % 31) - 15);
    return { dx, dy };
  }

  // Children: placed to the RIGHT of the parent (1 column over), stacking vertically
  if (parentIdea) {
    const existingSiblings = existingIdeas.filter(i => !i.isDeleted && i.parentId === parentIdea.id).length;
    const siblingIndex = existingSiblings + index;
    const j = jitter(ideaId || '');
    return {
      x: parentIdea.positionX + CELL_W + j.dx,
      y: parentIdea.positionY + siblingIndex * (CELL_H * 0.75) + j.dy,
    };
  }

  // Top-level ideas: fill grid left-to-right, then wrap to the next row
  const occupiedCells = new Set<string>();
  for (const idea of existingIdeas) {
    if (idea.isDeleted || idea.parentId) continue;
    const col = Math.round((idea.positionX - CANVAS_OFFSET_X) / CELL_W);
    const row = Math.round((idea.positionY - CANVAS_OFFSET_Y) / CELL_H);
    occupiedCells.add(`${col},${row}`);
  }

  const placedCount = existingIdeas.filter(i => !i.isDeleted && !i.parentId).length + index;
  const targetCol = placedCount % MAX_COLS;
  const targetRow = Math.floor(placedCount / MAX_COLS);

  const j = jitter(ideaId || '');

  if (!occupiedCells.has(`${targetCol},${targetRow}`)) {
    return {
      x: CANVAS_OFFSET_X + targetCol * CELL_W + j.dx,
      y: CANVAS_OFFSET_Y + targetRow * CELL_H + j.dy,
    };
  }

  // Fallback: find any free cell
  const maxRow = Math.max(targetRow + 1, existingIdeas.reduce((max, i) => {
    if (i.isDeleted || i.parentId) return max;
    return Math.max(max, Math.round((i.positionY - CANVAS_OFFSET_Y) / CELL_H));
  }, 0));

  for (let r = 0; r <= maxRow + 1; r++) {
    for (let c = 0; c < MAX_COLS; c++) {
      if (!occupiedCells.has(`${c},${r}`)) {
        return {
          x: CANVAS_OFFSET_X + c * CELL_W + j.dx,
          y: CANVAS_OFFSET_Y + r * CELL_H + j.dy,
        };
      }
    }
  }

  return { x: CANVAS_OFFSET_X + j.dx, y: CANVAS_OFFSET_Y + (maxRow + 1) * CELL_H + j.dy };
}

export function useIdeaExtraction({
  isActive,
  isDecisionOwner,
  sessionId,
  transcriptSegmentsRef,
  ideas,
  language,
  addIdea,
  addIdeaConnection,
  addModelRoutingLog,
  addError,
}: UseIdeaExtractionParams) {
  const lastProcessedIndexRef = useRef(0);
  const isExtractingRef = useRef(false);
  const sessionIdRef = useLatestRef(sessionId);
  const ideasRef = useLatestRef(ideas);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSuccessfulExtractionRef = useRef(Date.now());
  const extractionStartTimeRef = useRef<number | null>(null);

  // Reset extraction index when session changes and abort pending requests
  useEffect(() => {
    lastProcessedIndexRef.current = 0;
    isExtractingRef.current = false;
    // Abort any in-flight extraction request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!isActive || !isDecisionOwner) {
      console.log('[IdeaExtraction] Skipping — isActive:', isActive, 'isDecisionOwner:', isDecisionOwner);
      return;
    }

    console.log('[IdeaExtraction] Starting extraction interval (every', EXTRACTION_TICK_MS / 1000, 's)');

    const interval = setInterval(async () => {
      // Abort stale requests that have been running too long
      if (isExtractingRef.current && extractionStartTimeRef.current) {
        const elapsed = Date.now() - extractionStartTimeRef.current;
        if (elapsed > STALE_REQUEST_MS) {
          console.log('[IdeaExtraction] Aborting stale request after', (elapsed / 1000).toFixed(1), 's');
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
          }
          isExtractingRef.current = false;
          extractionStartTimeRef.current = null;
        } else {
          return; // Still processing, not stale yet
        }
      }

      if (isExtractingRef.current) return;

      const segments = transcriptSegmentsRef.current;
      const newCount = segments.length - lastProcessedIndexRef.current;

      // Adaptive threshold: lower to 1 segment when falling behind
      const timeSinceLastSuccess = Date.now() - lastSuccessfulExtractionRef.current;
      const minSegments = timeSinceLastSuccess > CATCHUP_THRESHOLD_MS
        ? MIN_NEW_SEGMENTS_CATCHUP
        : MIN_NEW_SEGMENTS_DEFAULT;

      console.log('[IdeaExtraction] Tick — total segments:', segments.length, 'lastProcessed:', lastProcessedIndexRef.current, 'new:', newCount, 'needed:', minSegments, 'timeSinceSuccess:', (timeSinceLastSuccess / 1000).toFixed(0) + 's');

      if (newCount < minSegments) return;

      isExtractingRef.current = true;
      extractionStartTimeRef.current = Date.now();
      console.log('[IdeaExtraction] Extracting ideas from', newCount, 'new segments...');

      try {
        const newSegments = segments.slice(lastProcessedIndexRef.current);
        const currentIdeas = ideasRef.current.filter(i => !i.isDeleted);
        const existingTitles = currentIdeas.map(i => i.title);
        const existingIdeasForApi = currentIdeas.map(i => ({ id: i.id, title: i.title, description: i.description, ideaType: i.ideaType || 'idea' }));

        // Include recent already-processed segments as context so the LLM
        // can understand conversational flow even when only 2-3 new segments arrive
        const contextStart = Math.max(0, lastProcessedIndexRef.current - CONTEXT_WINDOW_SEGMENTS);
        const contextSegments = segments.slice(contextStart, lastProcessedIndexRef.current);

        console.log('[IdeaExtraction] Sending', newSegments.length, 'new +', contextSegments.length, 'context segments to API');

        // Abort previous in-flight request if any
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await apiPost<{
          ideas?: Array<{ title: string; description?: string; author: string; sourceSegmentIds?: string[]; type?: string; ideaType?: string; parentTitle?: string | null; parentId?: string | null }>;
          connections?: Array<{ sourceTitle: string; targetTitle: string; sourceId?: string | null; targetId?: string | null; label?: string; type?: string }>;
          logEntry?: Record<string, unknown>;
        }>('/api/ideas/extract', {
          segments: newSegments.map(s => ({ id: s.id, speaker: s.speaker, text: s.text })),
          contextSegments: contextSegments.map(s => ({ id: s.id, speaker: s.speaker, text: s.text })),
          existingTitles,
          existingIdeas: existingIdeasForApi,
          language,
        }, { signal: controller.signal, maxRetries: 1 });

        const data = response;
        console.log('[IdeaExtraction] API response — ideas:', data.ideas?.length || 0, 'connections:', data.connections?.length || 0);

        if (data.logEntry) {
          addModelRoutingLog(data.logEntry as unknown as import('@/lib/types').ModelRoutingLogEntry);
        }

        // Build a title→id map for resolving connections
        const titleToId = new Map<string, string>();
        for (const idea of currentIdeas) {
          titleToId.set(idea.title.toLowerCase().trim(), idea.id);
        }

        // Process extracted ideas with staggered output
        const newIdeaIds: Array<{ title: string; id: string }> = [];

        if (data.ideas && Array.isArray(data.ideas)) {
          const sid = sessionIdRef.current;
          const ideaCount = data.ideas.length;

          for (let i = 0; i < ideaCount; i++) {
            const extracted = data.ideas[i];

            // Resolve parentId: prefer explicit parentId, fall back to parentTitle matching
            let resolvedParentId: string | null = null;
            if (extracted.parentId) {
              resolvedParentId = extracted.parentId;
            } else if (extracted.parentTitle) {
              resolvedParentId = titleToId.get(extracted.parentTitle.toLowerCase().trim()) || null;
            }

            // Find parent idea for position clustering
            const parentIdea = resolvedParentId
              ? ideasRef.current.find(i => i.id === resolvedParentId) ?? undefined
              : undefined;
            const ideaUUID = `idea-${crypto.randomUUID()}`;
            const position = calculatePosition(ideasRef.current, i, parentIdea, ideaUUID);

            const idea: Idea = {
              id: ideaUUID,
              sessionId: sid || '',
              title: extracted.title,
              description: extracted.description || null,
              author: extracted.author,
              source: 'auto',
              sourceSegmentIds: extracted.sourceSegmentIds || [],
              positionX: position.x,
              positionY: position.y,
              color: (extracted.ideaType ?? extracted.type) === 'category' ? 'slate' : getColorForAuthor(extracted.author),
              isDeleted: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              ideaType: (extracted.ideaType ?? extracted.type) === 'category' ? 'category' : 'idea',
              parentId: resolvedParentId,
            };

            // Stagger idea output: add 300ms delay between ideas when multiple are extracted
            if (i > 0 && ideaCount > 1) {
              await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY_MS));
            }

            console.log('[IdeaExtraction] Adding idea:', idea.title, '(by', idea.author + ')', `[${i + 1}/${ideaCount}]`);
            addIdea(idea);
            newIdeaIds.push({ title: extracted.title, id: idea.id });
            titleToId.set(extracted.title.toLowerCase().trim(), idea.id);

            if (sid) {
              persistIdea(sid, idea);
            }
          }
        }

        // Process connections
        if (data.connections && Array.isArray(data.connections)) {
          const sid = sessionIdRef.current;

          // Build set of all known idea IDs (existing + newly created)
          const knownIdeaIds = new Set<string>();
          for (const idea of ideasRef.current) {
            if (!idea.isDeleted) knownIdeaIds.add(idea.id);
          }
          for (const entry of newIdeaIds) {
            knownIdeaIds.add(entry.id);
          }

          for (const conn of data.connections) {
            // Resolve IDs: only trust LLM-provided IDs if they match a known idea.
            // Otherwise use title-based resolution (LLM can't know client-generated UUIDs)
            const sourceId = (conn.sourceId && knownIdeaIds.has(conn.sourceId))
              ? conn.sourceId
              : titleToId.get((conn.sourceTitle || '').toLowerCase().trim()) || null;
            const targetId = (conn.targetId && knownIdeaIds.has(conn.targetId))
              ? conn.targetId
              : titleToId.get((conn.targetTitle || '').toLowerCase().trim()) || null;

            if (!sourceId || !targetId || sourceId === targetId) {
              console.log('[IdeaExtraction] Skipping connection — unresolved:', conn.sourceTitle, '→', conn.targetTitle,
                '(sourceId:', sourceId, 'targetId:', targetId, ')');
              continue;
            }

            const connection: IdeaConnection = {
              id: `conn-${crypto.randomUUID()}`,
              sessionId: sid || '',
              sourceIdeaId: sourceId,
              targetIdeaId: targetId,
              label: conn.label || null,
              connectionType: (conn.type || 'related') as import('@/lib/types').IdeaConnectionType,
              createdAt: Date.now(),
            };

            console.log('[IdeaExtraction] Adding connection:', conn.sourceTitle, '→', conn.targetTitle, `(${conn.type || 'related'})`);
            addIdeaConnection(connection);

            if (sid) {
              persistConnection(sid, connection);
            }
          }
        }

        lastProcessedIndexRef.current = segments.length;
        lastSuccessfulExtractionRef.current = Date.now();
      } catch (error) {
        // Don't report aborted requests as errors
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('[IdeaExtraction] Request aborted (stale)');
        } else {
          console.error('Idea extraction error:', error);
          addError('Failed to extract ideas from transcript', 'idea_extraction');
        }
      } finally {
        isExtractingRef.current = false;
      }
    }, EXTRACTION_TICK_MS);

    return () => {
      clearInterval(interval);
      // Abort in-flight extraction on cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isActive, isDecisionOwner, transcriptSegmentsRef, language, addIdea, addIdeaConnection, addModelRoutingLog, addError]);
}
