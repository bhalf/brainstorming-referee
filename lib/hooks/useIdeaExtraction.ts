import { useEffect, useRef, MutableRefObject } from 'react';
import { TranscriptSegment, Idea, IdeaConnection } from '@/lib/types';
import { persistIdea, persistConnection } from '@/lib/services/ideaService';

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

const EXTRACTION_INTERVAL_MS = 4_000;
const MIN_NEW_SEGMENTS_DEFAULT = 2;
const MIN_NEW_SEGMENTS_CATCHUP = 1;
const CATCHUP_THRESHOLD_MS = 10_000;
const STALE_REQUEST_MS = 8_000;
const STAGGER_DELAY_MS = 300;
const CONTEXT_WINDOW_SEGMENTS = 5;

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

function calculatePosition(existingIdeas: Idea[], index: number, parentIdea?: Idea): { x: number; y: number } {
  const CELL_W = 320;
  const CELL_H = 260;
  const CHILD_COLS = 3;  // max children per row under a category
  const CHILD_INDENT = 40; // px indent for children vs parent

  // If there's a parent idea, place children in a neat grid below the parent
  if (parentIdea) {
    const existingSiblings = existingIdeas.filter(i => !i.isDeleted && i.parentId === parentIdea.id).length;
    const siblingIndex = existingSiblings + index;
    const offsetCol = siblingIndex % CHILD_COLS;
    const offsetRow = Math.floor(siblingIndex / CHILD_COLS) + 1;
    return {
      x: parentIdea.positionX + CHILD_INDENT + offsetCol * (CELL_W * 0.75),
      y: parentIdea.positionY + offsetRow * CELL_H,
    };
  }

  // For categories and orphan ideas: place in the main grid
  // Categories get column 0, orphan ideas fill remaining columns
  const occupiedCells = new Set<string>();
  for (const idea of existingIdeas) {
    if (idea.isDeleted) continue;
    const col = Math.round(idea.positionX / CELL_W);
    const row = Math.round(idea.positionY / CELL_H);
    occupiedCells.add(`${col},${row}`);
  }

  // Find the next free row (scan from first row downward)
  const maxRow = existingIdeas.reduce((max, i) => {
    if (i.isDeleted) return max;
    return Math.max(max, Math.round(i.positionY / CELL_H));
  }, -1);

  // Place in the first free cell from the next available position
  let startRow = maxRow + 1;
  // Try to fit in existing rows first
  for (let r = 0; r <= startRow; r++) {
    for (let c = 0; c < 4; c++) {
      if (!occupiedCells.has(`${c},${r}`)) {
        return { x: c * CELL_W, y: r * CELL_H };
      }
    }
  }

  return { x: 0, y: startRow * CELL_H };
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
  const sessionIdRef = useRef(sessionId);
  const ideasRef = useRef(ideas);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSuccessfulExtractionRef = useRef(Date.now());
  const extractionStartTimeRef = useRef<number | null>(null);

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { ideasRef.current = ideas; }, [ideas]);

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

    console.log('[IdeaExtraction] Starting extraction interval (every', EXTRACTION_INTERVAL_MS / 1000, 's)');

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

        const response = await fetch('/api/ideas/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            segments: newSegments.map(s => ({ id: s.id, speaker: s.speaker, text: s.text })),
            contextSegments: contextSegments.map(s => ({ id: s.id, speaker: s.speaker, text: s.text })),
            existingTitles,
            existingIdeas: existingIdeasForApi,
            language,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.error('[IdeaExtraction] API failed:', response.status, errText);
          return;
        }

        const data = await response.json();
        console.log('[IdeaExtraction] API response — ideas:', data.ideas?.length || 0, 'connections:', data.connections?.length || 0);

        if (data.logEntry) {
          addModelRoutingLog(data.logEntry);
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
            const position = calculatePosition(ideasRef.current, i, parentIdea);

            const idea: Idea = {
              id: `idea-${crypto.randomUUID()}`,
              sessionId: sid || '',
              title: extracted.title,
              description: extracted.description || null,
              author: extracted.author,
              source: 'auto',
              sourceSegmentIds: extracted.sourceSegmentIds || [],
              positionX: position.x,
              positionY: position.y,
              color: extracted.ideaType === 'category' ? 'slate' : getColorForAuthor(extracted.author),
              isDeleted: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              ideaType: extracted.ideaType === 'category' ? 'category' : 'idea',
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

          for (const conn of data.connections) {
            // Resolve IDs: prefer explicit IDs from LLM, fall back to title matching
            const sourceId = conn.sourceId || titleToId.get(conn.sourceTitle.toLowerCase().trim());
            const targetId = conn.targetId || titleToId.get(conn.targetTitle.toLowerCase().trim());

            if (!sourceId || !targetId || sourceId === targetId) continue;

            const connection: IdeaConnection = {
              id: `conn-${crypto.randomUUID()}`,
              sessionId: sid || '',
              sourceIdeaId: sourceId,
              targetIdeaId: targetId,
              label: conn.label || null,
              connectionType: conn.type || 'related',
              createdAt: Date.now(),
            };

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
    }, EXTRACTION_INTERVAL_MS);

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
