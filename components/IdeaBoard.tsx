'use client';

import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Idea, IdeaConnection } from '@/lib/types';
import { persistIdea, updateIdea as updateIdeaApi } from '@/lib/services/ideaService';
import { downloadIdeaBoard } from './IdeaBoardExport';

interface IdeaBoardProps {
  ideas: Idea[];
  connections: IdeaConnection[];
  sessionId: string | null;
  onAddIdea: (idea: Idea) => void;
  onUpdateIdea: (id: string, updates: Partial<Idea>) => void;
  onRemoveIdea: (id: string) => void;
  displayName: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  roomName?: string;
}

// --- Color mapping ---

const COLOR_MAP: Record<string, { bg: string; border: string; badge: string }> = {
  'yellow': { bg: '#fef9c3', border: '#fde047', badge: '#a16207' },
  'light-green': { bg: '#dcfce7', border: '#86efac', badge: '#15803d' },
  'light-blue': { bg: '#dbeafe', border: '#93c5fd', badge: '#1d4ed8' },
  'light-red': { bg: '#fee2e2', border: '#fca5a5', badge: '#b91c1c' },
  'light-violet': { bg: '#ede9fe', border: '#c4b5fd', badge: '#6d28d9' },
  'orange': { bg: '#ffedd5', border: '#fdba74', badge: '#c2410c' },
  'blue': { bg: '#bfdbfe', border: '#60a5fa', badge: '#1e40af' },
  'green': { bg: '#bbf7d0', border: '#4ade80', badge: '#166534' },
  'slate': { bg: '#1e293b', border: '#475569', badge: '#64748b' },
};

function getColor(color: string) {
  return COLOR_MAP[color] || COLOR_MAP['yellow'];
}

// --- Connection type → edge style ---

const EDGE_STYLES: Record<string, {
  stroke: string; label: string; labelDE: string; desc: string;
  animated: boolean; strokeDash?: string; strokeWidth: number;
}> = {
  builds_on: { stroke: '#22c55e', label: 'builds on', labelDE: 'Baut auf', desc: 'erweitert eine Idee', animated: true, strokeWidth: 2.5 },
  supports: { stroke: '#3b82f6', label: 'supports', labelDE: 'Unterstützt', desc: 'bestätigt eine Idee', animated: true, strokeWidth: 2.5 },
  leads_to: { stroke: '#a855f7', label: 'leads to', labelDE: 'Führt zu', desc: 'folgt logisch draus', animated: true, strokeWidth: 2.5 },
  contrasts: { stroke: '#f97316', label: 'contrasts', labelDE: 'Kontrastiert', desc: 'Alternative / Gegensatz', animated: false, strokeDash: '8 4', strokeWidth: 2 },
  related: { stroke: '#64748b', label: 'related', labelDE: 'Verwandt', desc: 'thematisch ähnlich', animated: false, strokeDash: '4 4', strokeWidth: 1.5 },
};

// --- Connection Legend ---

const ConnectionLegend = memo(function ConnectionLegend() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {Object.entries(EDGE_STYLES).map(([key, style]) => (
        <div key={key} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          backgroundColor: 'rgba(15,23,42,0.7)',
          border: `1px solid ${style.stroke}44`,
          borderRadius: 20,
          padding: '2px 8px 2px 5px',
        }}>
          {/* Line sample */}
          <svg width="18" height="10" viewBox="0 0 18 10">
            <line
              x1="0" y1="5" x2="18" y2="5"
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.strokeDash || 'none'}
            />
            {style.animated && (
              <polygon points="14,2 18,5 14,8" fill={style.stroke} />
            )}
          </svg>
          <span style={{ fontSize: 10, fontWeight: 600, color: style.stroke }}>
            {style.labelDE}
          </span>
          <span style={{ fontSize: 9, color: '#64748b' }}>— {style.desc}</span>
        </div>
      ))}
      {/* Contains (parent→child) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(15,23,42,0.7)',
        border: '1px solid #33415544',
        borderRadius: 20,
        padding: '2px 8px 2px 5px',
      }}>
        <svg width="18" height="10" viewBox="0 0 18 10">
          <line x1="0" y1="5" x2="18" y2="5" stroke="#334155" strokeWidth="1.5" strokeDasharray="6 3" />
        </svg>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>Enthält</span>
        <span style={{ fontSize: 9, color: '#64748b' }}>— Kategorie-Unteridee</span>
      </div>
    </div>
  );
});

// --- Custom Sticky Note Node ---

interface StickyNoteData {
  title: string;
  description: string | null;
  author: string;
  color: string;
  source: string;
  ideaType: string;
  childCount: number;
  connectionCount: number;
  isNew: boolean;
  onDelete: (id: string) => void;
  [key: string]: unknown;
}

const handleStyle = { width: 6, height: 6, background: '#94a3b8', border: 'none', opacity: 0.4 };

const StickyNoteNode = memo(function StickyNoteNode({ id, data }: NodeProps<Node<StickyNoteData>>) {
  const isCategory = data.ideaType === 'category';
  const colors = getColor(data.color);

  if (isCategory) {
    return (
      <div
        className="group relative"
        style={{
          width: 280,
          minHeight: 70,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '2px solid #334155',
          borderRadius: 14,
          padding: '16px 18px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
          cursor: 'grab',
        }}
      >
        <Handle type="target" position={Position.Top} style={handleStyle} />
        <Handle type="source" position={Position.Bottom} style={handleStyle} />

        <button
          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: 'rgba(220,38,38,0.8)', color: 'white' }}
          onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
          title="Delete category"
        >
          ×
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 15, filter: 'grayscale(0.2)' }}>📁</span>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            {data.title}
          </h3>
        </div>

        {data.description && (
          <p style={{ margin: '4px 0 0 23px', fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
            {data.description}
          </p>
        )}

        <div style={{ marginTop: 8, marginLeft: 23, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 9999,
            color: '#cbd5e1',
            backgroundColor: '#334155',
            border: '1px solid #475569',
          }}>
            {data.childCount} {data.childCount !== 1 ? 'Ideen' : 'Idee'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative"
      style={{
        width: 200,
        minHeight: 120,
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: 10,
        padding: '12px 14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        cursor: 'grab',
      }}
    >
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />

      <button
        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ backgroundColor: 'rgba(220,38,38,0.8)', color: 'white' }}
        onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
        title="Delete idea"
      >
        ×
      </button>

      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b', lineHeight: 1.3, paddingRight: 16 }}>
        {data.title}
      </h3>

      {data.description && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569', lineHeight: 1.4 }}>
          {data.description}
        </p>
      )}

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          padding: '2px 6px',
          borderRadius: 9999,
          color: 'white',
          backgroundColor: colors.badge,
        }}>
          {data.author}
        </span>
        {data.connectionCount > 0 && (
          <span style={{
            fontSize: 9,
            fontWeight: 500,
            padding: '1px 5px',
            borderRadius: 9999,
            color: '#94a3b8',
            backgroundColor: 'rgba(148,163,184,0.15)',
            border: '1px solid rgba(148,163,184,0.25)',
          }}>
            {data.connectionCount} ↔
          </span>
        )}
        {data.source === 'auto' && (
          <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>auto</span>
        )}
      </div>
      {/* Pulse glow for new ideas */}
      {data.isNew && (
        <div style={{
          position: 'absolute',
          inset: -3,
          borderRadius: 13,
          border: `2px solid ${colors.border}`,
          animation: 'idea-pulse 1.5s ease-out 2',
          pointerEvents: 'none',
          opacity: 0,
        }} />
      )}
    </div>
  );
});

// Inject keyframe animations
if (typeof document !== 'undefined' && !document.getElementById('idea-board-styles')) {
  const style = document.createElement('style');
  style.id = 'idea-board-styles';
  style.textContent = `
    @keyframes idea-pulse {
      0% { opacity: 0.8; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.08); }
    }
  `;
  document.head.appendChild(style);
}

const nodeTypes: NodeTypes = { stickyNote: StickyNoteNode };

// --- Main Component ---

export default function IdeaBoard({
  ideas,
  connections,
  sessionId,
  onAddIdea,
  onUpdateIdea,
  onRemoveIdea,
  displayName,
  isCollapsed,
  onToggleCollapse,
  roomName = 'session',
}: IdeaBoardProps) {
  const [nodes, setNodes] = useState<Node<StickyNoteData>[]>([]);
  const [showLegend, setShowLegend] = useState(false);
  const draggingNodeRef = useRef<string | null>(null);
  const newIdeaIdsRef = useRef<Set<string>>(new Set());

  // Stable refs for callbacks used in node data
  const onRemoveIdeaRef = useRef(onRemoveIdea);
  onRemoveIdeaRef.current = onRemoveIdea;
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Stable delete handler (never changes → no node data churn)
  const stableDelete = useCallback((ideaId: string) => {
    onRemoveIdeaRef.current(ideaId);
    const sid = sessionIdRef.current;
    if (sid) {
      updateIdeaApi(ideaId, { isDeleted: true });
    }
  }, []);

  // Sync ideas → React Flow nodes (only non-deleted)
  const activeIdeas = useMemo(() => ideas.filter(i => !i.isDeleted), [ideas]);

  useEffect(() => {
    setNodes(currentNodes => {
      const currentMap = new Map(currentNodes.map(n => [n.id, n]));
      // Count children per category
      const childCounts = new Map<string, number>();
      for (const idea of activeIdeas) {
        if (idea.parentId) {
          childCounts.set(idea.parentId, (childCounts.get(idea.parentId) || 0) + 1);
        }
      }
      // Count connections per idea
      const connectionCounts = new Map<string, number>();
      for (const conn of connections) {
        connectionCounts.set(conn.sourceIdeaId, (connectionCounts.get(conn.sourceIdeaId) || 0) + 1);
        connectionCounts.set(conn.targetIdeaId, (connectionCounts.get(conn.targetIdeaId) || 0) + 1);
      }
      // Detect new ideas (not yet in current nodes)
      const currentIds = new Set(currentNodes.map(n => n.id));
      for (const idea of activeIdeas) {
        if (!currentIds.has(idea.id)) {
          newIdeaIdsRef.current.add(idea.id);
          // Remove "new" flag after 3 seconds
          setTimeout(() => {
            newIdeaIdsRef.current.delete(idea.id);
            setNodes(prev => prev.map(n => n.id === idea.id
              ? { ...n, data: { ...n.data, isNew: false } }
              : n
            ));
          }, 3000);
        }
      }
      return activeIdeas.map(idea => {
        const existing = currentMap.get(idea.id);
        const isDragging = draggingNodeRef.current === idea.id;

        return {
          id: idea.id,
          type: 'stickyNote' as const,
          position: isDragging && existing
            ? existing.position
            : { x: idea.positionX, y: idea.positionY },
          data: {
            title: idea.title,
            description: idea.description,
            author: idea.author,
            color: idea.color,
            source: idea.source,
            ideaType: idea.ideaType || 'idea',
            childCount: childCounts.get(idea.id) || 0,
            connectionCount: connectionCounts.get(idea.id) || 0,
            isNew: newIdeaIdsRef.current.has(idea.id),
            onDelete: stableDelete,
          },
          ...(existing ? { selected: existing.selected } : {}),
        };
      });
    });
  }, [activeIdeas, connections, stableDelete]);

  // Convert connections → React Flow edges (only if both source+target nodes exist)
  const edges: Edge[] = useMemo(() => {
    const ideaIds = new Set(activeIdeas.map(i => i.id));

    // Explicit connections from the LLM / user
    const explicitEdges = connections
      .filter(c => ideaIds.has(c.sourceIdeaId) && ideaIds.has(c.targetIdeaId))
      .map(conn => {
        const style = EDGE_STYLES[conn.connectionType] || EDGE_STYLES.related;
        // Always show the German label so users know what the connection means
        const rawLabel = conn.label || style.labelDE;
        const label = rawLabel.length > 28 ? rawLabel.slice(0, 26) + '…' : rawLabel;
        return {
          id: conn.id,
          source: conn.sourceIdeaId,
          target: conn.targetIdeaId,
          label,
          animated: style.animated,
          type: 'smoothstep',
          style: {
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            strokeDasharray: style.strokeDash || undefined,
          },
          labelStyle: { fontSize: 10, fontWeight: 700, fill: style.stroke },
          labelBgStyle: { fill: '#0f172a', fillOpacity: 0.92 },
          labelBgPadding: [5, 4] as [number, number],
          labelBgBorderRadius: 6,
        };
      });

    // Auto-generated parent→child "contains" edges — no label, subtle dashed line
    const containsEdges = activeIdeas
      .filter(i => i.parentId && ideaIds.has(i.parentId))
      .map(idea => ({
        id: `contains-${idea.parentId}-${idea.id}`,
        source: idea.parentId!,
        target: idea.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#334155', strokeWidth: 1.5, strokeDasharray: '8 4' },
      }));

    return [...explicitEdges, ...containsEdges];
  }, [connections, activeIdeas]);

  // Handle React Flow node changes (drag, select)
  const onNodesChange = useCallback((changes: NodeChange<Node<StickyNoteData>>[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);

  // Drag handlers
  const onNodeDragStart = useCallback((_: unknown, node: Node) => {
    draggingNodeRef.current = node.id;
  }, []);

  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    draggingNodeRef.current = null;
    onUpdateIdea(node.id, { positionX: node.position.x, positionY: node.position.y });
    if (sessionId) {
      updateIdeaApi(node.id, { positionX: node.position.x, positionY: node.position.y });
    }
  }, [onUpdateIdea, sessionId]);

  // Add manual idea
  const handleAddIdea = useCallback(() => {
    // Place at center of existing ideas or default position
    const currentIdeas = ideas.filter(i => !i.isDeleted);
    let x = 100, y = 100;
    if (currentIdeas.length > 0) {
      const maxX = Math.max(...currentIdeas.map(i => i.positionX));
      const maxY = Math.max(...currentIdeas.map(i => i.positionY));
      x = (maxX + 300) % 1200;
      y = maxY + (x < 300 ? 260 : 0);
    }

    const COLORS = ['yellow', 'light-green', 'light-blue', 'light-red', 'light-violet', 'orange'];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    const idea: Idea = {
      id: `idea-${crypto.randomUUID()}`,
      sessionId: sessionId || '',
      title: 'New Idea',
      description: null,
      author: displayName,
      source: 'manual',
      sourceSegmentIds: [],
      positionX: x,
      positionY: y,
      color,
      isDeleted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ideaType: 'idea',
      parentId: null,
    };

    onAddIdea(idea);
    if (sessionId) {
      persistIdea(sessionId, idea);
    }
  }, [sessionId, displayName, onAddIdea, ideas]);

  return (
    <div className="flex flex-col rounded-lg border border-slate-700 overflow-hidden bg-slate-800/50 h-full">
      {/* Header */}
      <div className="h-[44px] flex items-center justify-between px-3 bg-slate-800/80 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM4 11a1 1 0 100-2H3a1 1 0 000 2h1zM10 18a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1z" />
            <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" clipRule="evenodd" />
          </svg>
          <span className="text-white text-sm font-medium">Idea Board</span>
          <span className="text-xs text-slate-400">
            ({activeIdeas.length} {activeIdeas.length !== 1 ? 'Ideen' : 'Idee'}
            {connections.length > 0 ? `, ${connections.length} Verbindung${connections.length !== 1 ? 'en' : ''}` : ''})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <>
              <button
                onClick={() => downloadIdeaBoard(ideas, connections, roomName)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-500 hidden md:flex items-center gap-1"
                title="Idea Board als Markdown exportieren"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
              <button
                onClick={() => setShowLegend(v => !v)}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-500 hidden md:flex items-center gap-1"
                title="Verbindungslegende ein-/ausblenden"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Legende
              </button>
              <button
                onClick={handleAddIdea}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors min-h-[44px]"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Idee hinzufügen
              </button>
            </>
          )}
          <button
            onClick={onToggleCollapse}
            className="text-slate-400 hover:text-white transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
            title={isCollapsed ? 'Idea Board ausklappen' : 'Idea Board einklappen'}
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Legend strip — collapsible, always available */}
      {!isCollapsed && showLegend && (
        <div className="hidden md:block px-3 py-2 bg-slate-900/60 border-b border-slate-700/60 shrink-0">
          <ConnectionLegend />
        </div>
      )}

      {/* React Flow Canvas */}
      {!isCollapsed && (
        <div className="flex-1" style={{ minHeight: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={3}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
            <MiniMap
              className="hidden lg:block"
              nodeColor={(node) => {
                const d = node.data as StickyNoteData;
                return getColor(d.color).bg;
              }}
              style={{ backgroundColor: '#f1f5f9' }}
              maskColor="rgba(0,0,0,0.1)"
            />
            <Controls className="hidden lg:flex" showInteractive={false} />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
