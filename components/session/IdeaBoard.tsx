'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Idea, IdeaConnection, IdeaType, ConnectionType, NoveltyRole } from '@/types';
import { createIdea, updateIdea as updateIdeaApi, deleteIdea } from '@/lib/api-client';

interface IdeaBoardProps {
  ideas: Idea[];
  connections: IdeaConnection[];
  sessionId: string;
  /** Session language for i18n (e.g. 'de-CH', 'en-US') */
  language?: string;
  /** Hide create/edit/delete UI for review mode */
  readOnly?: boolean;
}

// ============================================================
// i18n
// ============================================================

type LangKey = 'de' | 'en' | 'fr';

function resolveLang(language?: string): LangKey {
  if (!language) return 'de';
  if (language.startsWith('fr')) return 'fr';
  if (language.startsWith('en')) return 'en';
  return 'de';
}

const I18N: Record<LangKey, {
  ideaBoard: string;
  ideas: string;
  idea: string;
  connections: string;
  connection: string;
  legend: string;
  addIdea: string;
  newIdea: string;
  noIdeas: string;
  editIdea: string;
  descriptionOptional: string;
  cancel: string;
  save: string;
  ideaType: string;
  impulseType: string;
  actionType: string;
  builds_on: string;
  builds_on_desc: string;
  supports: string;
  supports_desc: string;
  leads_to: string;
  leads_to_desc: string;
  contrasts: string;
  contrasts_desc: string;
  related: string;
  related_desc: string;
  contains: string;
  contains_desc: string;
  refines: string;
  refines_desc: string;
}> = {
  de: {
    ideaBoard: 'Idea Board',
    ideas: 'Ideen',
    idea: 'Idee',
    connections: 'Verbindungen',
    connection: 'Verbindung',
    legend: 'Legende',
    addIdea: 'Idee hinzufügen',
    newIdea: 'Neue Idee...',
    noIdeas: 'Noch keine Ideen',
    editIdea: 'Idee bearbeiten',
    descriptionOptional: 'Beschreibung (optional)',
    cancel: 'Abbrechen',
    save: 'Speichern',
    ideaType: 'Idee',
    impulseType: 'Impuls',
    actionType: 'Aktion',
    builds_on: 'Baut auf',
    builds_on_desc: 'erweitert eine Idee',
    supports: 'Unterstützt',
    supports_desc: 'bestätigt eine Idee',
    leads_to: 'Führt zu',
    leads_to_desc: 'folgt logisch draus',
    contrasts: 'Kontrastiert',
    contrasts_desc: 'Alternative / Gegensatz',
    related: 'Verwandt',
    related_desc: 'thematisch ähnlich',
    contains: 'Enthält',
    contains_desc: 'Kategorie-Unteridee',
    refines: 'Verfeinert',
    refines_desc: 'präzisiert eine Idee',
  },
  en: {
    ideaBoard: 'Idea Board',
    ideas: 'Ideas',
    idea: 'Idea',
    connections: 'Connections',
    connection: 'Connection',
    legend: 'Legend',
    addIdea: 'Add idea',
    newIdea: 'New idea...',
    noIdeas: 'No ideas yet',
    editIdea: 'Edit idea',
    descriptionOptional: 'Description (optional)',
    cancel: 'Cancel',
    save: 'Save',
    ideaType: 'Idea',
    impulseType: 'Impulse',
    actionType: 'Action',
    builds_on: 'Builds on',
    builds_on_desc: 'extends an idea',
    supports: 'Supports',
    supports_desc: 'confirms an idea',
    leads_to: 'Leads to',
    leads_to_desc: 'logical consequence',
    contrasts: 'Contrasts',
    contrasts_desc: 'alternative / opposite',
    related: 'Related',
    related_desc: 'thematically similar',
    contains: 'Contains',
    contains_desc: 'category sub-idea',
    refines: 'Refines',
    refines_desc: 'makes more precise',
  },
  fr: {
    ideaBoard: 'Tableau d\'idées',
    ideas: 'Idées',
    idea: 'Idée',
    connections: 'Connexions',
    connection: 'Connexion',
    legend: 'Légende',
    addIdea: 'Ajouter une idée',
    newIdea: 'Nouvelle idée...',
    noIdeas: 'Pas encore d\'idées',
    editIdea: 'Modifier l\'idée',
    descriptionOptional: 'Description (facultatif)',
    cancel: 'Annuler',
    save: 'Enregistrer',
    ideaType: 'Idée',
    impulseType: 'Impulsion',
    actionType: 'Action',
    builds_on: 'S\'appuie sur',
    builds_on_desc: 'développe une idée',
    supports: 'Soutient',
    supports_desc: 'confirme une idée',
    leads_to: 'Mène à',
    leads_to_desc: 'conséquence logique',
    contrasts: 'Contraste',
    contrasts_desc: 'alternative / opposé',
    related: 'Lié',
    related_desc: 'thématiquement similaire',
    contains: 'Contient',
    contains_desc: 'sous-idée de catégorie',
    refines: 'Affine',
    refines_desc: 'précise une idée',
  },
};

// ============================================================
// Styling
// ============================================================

const IDEA_TYPE_STYLES: Record<IdeaType, { gradient: string; border: string; badge: string; miniMapColor: string }> = {
  brainstorming_idea: {
    gradient: 'from-indigo-500/15 to-violet-500/10',
    border: 'border-indigo-400/20 hover:border-indigo-400/35',
    badge: 'bg-indigo-500/20 text-indigo-300',
    miniMapColor: 'rgba(99, 102, 241, 0.4)',
  },
  ally_intervention: {
    gradient: 'from-emerald-500/15 to-green-500/10',
    border: 'border-emerald-400/20 hover:border-emerald-400/35',
    badge: 'bg-emerald-500/20 text-emerald-300',
    miniMapColor: 'rgba(52, 211, 153, 0.4)',
  },
  action_item: {
    gradient: 'from-amber-500/15 to-orange-500/10',
    border: 'border-amber-400/20 hover:border-amber-400/35',
    badge: 'bg-amber-500/20 text-amber-300',
    miniMapColor: 'rgba(251, 191, 36, 0.4)',
  },
};

const NOVELTY_ROLE_STYLES: Record<NoveltyRole, { badge: string; icon: string }> = {
  seed: { badge: 'bg-green-500/20 text-green-300', icon: '✦' },
  extension: { badge: 'bg-blue-500/20 text-blue-300', icon: '↗' },
  variant: { badge: 'bg-purple-500/20 text-purple-300', icon: '≈' },
  tangent: { badge: 'bg-orange-500/20 text-orange-300', icon: '↯' },
};

const NOVELTY_ROLE_LABELS: Record<LangKey, Record<NoveltyRole, string>> = {
  de: { seed: 'Neu', extension: 'Erweiterung', variant: 'Variante', tangent: 'Tangente' },
  en: { seed: 'Seed', extension: 'Extension', variant: 'Variant', tangent: 'Tangent' },
  fr: { seed: 'Graine', extension: 'Extension', variant: 'Variante', tangent: 'Tangente' },
};

interface ConnectionStyleDef {
  stroke: string;
  animated: boolean;
  strokeDash?: string;
  strokeWidth: number;
}

const CONNECTION_STYLES: Record<ConnectionType, ConnectionStyleDef> = {
  builds_on: { stroke: '#22c55e', animated: true, strokeWidth: 2.5 },
  supports: { stroke: '#3b82f6', animated: true, strokeWidth: 2.5 },
  leads_to: { stroke: '#a855f7', animated: true, strokeWidth: 2.5 },
  contrasts: { stroke: '#f97316', animated: false, strokeDash: '8 4', strokeWidth: 2 },
  related: { stroke: '#64748b', animated: false, strokeDash: '4 4', strokeWidth: 1.5 },
  contains: { stroke: '#334155', animated: false, strokeDash: '6 3', strokeWidth: 1.5 },
  refines: { stroke: '#a78bfa', animated: true, strokeWidth: 2 },
};

// ============================================================
// Node Component
// ============================================================

type StickyNodeData = {
  label: string;
  description?: string;
  authorName?: string;
  ideaType: IdeaType;
  ideaTypeLabel: string;
  noveltyRole?: NoveltyRole;
  noveltyRoleLabel?: string;
  color?: string;
  readOnly?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

const StickyNode = memo(function StickyNode({ id, data }: NodeProps<Node<StickyNodeData>>) {
  const typeStyle = IDEA_TYPE_STYLES[data.ideaType] || IDEA_TYPE_STYLES.brainstorming_idea;

  return (
    <div
      className={`bg-gradient-to-br ${typeStyle.gradient} backdrop-blur-sm border ${typeStyle.border} rounded-2xl p-3.5 shadow-lg shadow-black/20 min-w-[140px] max-w-[200px] transition-all hover:shadow-xl`}
      style={data.color ? { borderColor: `${data.color}40` } : undefined}
    >
      <Handle type="target" position={Position.Top} className="!bg-indigo-400 !border-none !w-2 !h-2" />

      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1 flex-wrap">
            <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${typeStyle.badge}`}>
              {data.ideaTypeLabel}
            </span>
            {data.noveltyRole && (() => {
              const roleStyle = NOVELTY_ROLE_STYLES[data.noveltyRole];
              return (
                <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-md ${roleStyle.badge}`}>
                  {roleStyle.icon} {data.noveltyRoleLabel}
                </span>
              );
            })()}
          </div>
          <h4 className="text-sm font-medium text-[var(--text-primary)] leading-tight">{data.label}</h4>
        </div>
        {!data.readOnly && (
          <div className="flex gap-0.5 shrink-0">
            <button
              onClick={() => data.onEdit(id)}
              className="text-[var(--text-tertiary)] hover:text-indigo-400 text-xs p-1 rounded-md hover:bg-white/[0.06] transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => data.onDelete(id)}
              className="text-[var(--text-tertiary)] hover:text-rose-400 text-xs p-1 rounded-md hover:bg-white/[0.06] transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {data.description && (
        <p className="text-xs text-[var(--text-tertiary)] mt-1.5 line-clamp-3 leading-relaxed">{data.description}</p>
      )}
      {data.authorName && (
        <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 font-mono opacity-60">— {data.authorName}</p>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-violet-400 !border-none !w-2 !h-2" />
    </div>
  );
});

const nodeTypes: NodeTypes = {
  sticky: StickyNode as unknown as NodeTypes['sticky'],
};

// ============================================================
// Legend Component
// ============================================================

const LEGEND_CONNECTIONS: ConnectionType[] = ['builds_on', 'supports', 'leads_to', 'contrasts', 'related', 'contains'];

function ConnectionLegend({ t }: { t: typeof I18N['de'] }) {
  return (
    <div className="flex flex-wrap gap-1.5 p-2.5">
      {LEGEND_CONNECTIONS.map((key) => {
        const style = CONNECTION_STYLES[key];
        const label = t[key as keyof typeof t] as string;
        const desc = t[`${key}_desc` as keyof typeof t] as string;
        return (
          <div
            key={key}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{
              backgroundColor: 'rgba(15,23,42,0.7)',
              border: `1px solid ${style.stroke}44`,
            }}
          >
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
            <span className="text-[10px] font-semibold" style={{ color: style.stroke }}>
              {label}
            </span>
            <span className="text-[9px] text-[var(--text-tertiary)]">— {desc}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function IdeaBoard({ ideas, connections, sessionId, language, readOnly }: IdeaBoardProps) {
  const t = I18N[resolveLang(language)];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const visibleIdeas = useMemo(() => ideas.filter((i) => !i.is_deleted), [ideas]);

  const ideaTypeLabel = useCallback((type: IdeaType) => {
    if (type === 'ally_intervention') return t.impulseType;
    if (type === 'action_item') return t.actionType;
    return t.ideaType;
  }, [t]);

  const handleEdit = useCallback((id: string) => {
    const idea = visibleIdeas.find((i) => i.id === id);
    if (idea) {
      setEditingId(id);
      setEditTitle(idea.title);
      setEditDescription(idea.description || '');
    }
  }, [visibleIdeas]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteIdea(sessionId, id);
    } catch (err) {
      console.error('Failed to delete idea:', err);
    }
  }, [sessionId]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editTitle.trim()) return;
    try {
      await updateIdeaApi(sessionId, editingId, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setEditingId(null);
    } catch (err) {
      console.error('Failed to update idea:', err);
    }
  }, [sessionId, editingId, editTitle, editDescription]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || isCreating) return;
    setIsCreating(true);
    try {
      await createIdea(sessionId, { title: newTitle.trim() });
      setNewTitle('');
    } catch (err) {
      console.error('Failed to create idea:', err);
    } finally {
      setIsCreating(false);
    }
  }, [sessionId, newTitle, isCreating]);

  const langKey = resolveLang(language);

  const nodes = useMemo((): Node<StickyNodeData>[] => {
    return visibleIdeas.map((idea, index) => ({
      id: idea.id,
      type: 'sticky',
      position: {
        x: idea.position_x ?? (index % 4) * 220 + 40,
        y: idea.position_y ?? Math.floor(index / 4) * 160 + 40,
      },
      data: {
        label: idea.title,
        description: idea.description,
        authorName: idea.author_name,
        ideaType: idea.idea_type,
        ideaTypeLabel: ideaTypeLabel(idea.idea_type),
        noveltyRole: idea.novelty_role,
        noveltyRoleLabel: idea.novelty_role ? NOVELTY_ROLE_LABELS[langKey][idea.novelty_role] : undefined,
        color: idea.color,
        readOnly,
        onEdit: handleEdit,
        onDelete: handleDelete,
      },
    }));
  }, [visibleIdeas, handleEdit, handleDelete, ideaTypeLabel, langKey]);

  const edges = useMemo((): Edge[] => {
    return connections.map((conn) => {
      const style = CONNECTION_STYLES[conn.connection_type] || CONNECTION_STYLES.builds_on;
      const label = t[conn.connection_type as keyof typeof t] as string || conn.connection_type;
      return {
        id: conn.id,
        source: conn.source_idea_id,
        target: conn.target_idea_id,
        animated: style.animated,
        type: 'smoothstep',
        style: {
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDash || undefined,
        },
        label,
        labelStyle: { fontSize: 10, fontWeight: 700, fill: style.stroke },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.92 },
        labelBgPadding: [5, 4] as [number, number],
        labelBgBorderRadius: 6,
      };
    });
  }, [connections, t]);

  const onNodesChange = useCallback((_changes: NodeChange[]) => {
    // Read-only — positions come from backend
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-glass)] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-sm font-medium text-[var(--text-primary)]">{t.ideaBoard}</span>
          <span className="text-xs text-[var(--text-tertiary)]">
            ({visibleIdeas.length} {visibleIdeas.length !== 1 ? t.ideas : t.idea}
            {connections.length > 0 ? `, ${connections.length} ${connections.length !== 1 ? t.connections : t.connection}` : ''})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowLegend((v) => !v)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
              showLegend
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                : 'border-[var(--border-glass)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:border-[var(--border-glass-hover)]'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t.legend}
          </button>
        </div>
      </div>

      {/* Legend (collapsible) */}
      {showLegend && (
        <div className="shrink-0 border-b border-[var(--border-glass)] bg-white/[0.01] animate-fade-in overflow-x-auto">
          <ConnectionLegend t={t} />
        </div>
      )}

      {/* Create idea input */}
      {!readOnly && (
        <div className="shrink-0 p-3 border-b border-[var(--border-glass)] flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder={t.newIdea}
            className="input-glass flex-1 text-sm py-2"
          />
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim() || isCreating}
            className="btn-primary px-3.5 py-2 text-sm disabled:opacity-30 flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="hidden sm:inline text-xs">{t.addIdea}</span>
          </button>
        </div>
      )}

      {/* Edit modal */}
      {!readOnly && editingId && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-scale">
          <div className="glass p-5 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t.editIdea}</h3>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="input-glass text-sm"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder={t.descriptionOptional}
              rows={3}
              className="input-glass text-sm resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingId(null)} className="btn-glass px-3 py-2 text-sm">
                {t.cancel}
              </button>
              <button onClick={handleSaveEdit} className="btn-primary px-4 py-2 text-sm">
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* React Flow canvas */}
      <div className="flex-1 min-h-0">
        {visibleIdeas.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm">{t.noIdeas}</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            nodeTypes={nodeTypes}
            fitView
            defaultEdgeOptions={{ type: 'smoothstep' }}
            proOptions={{ hideAttribution: true }}
          >
            <Controls className="!bg-white/[0.05] !border-white/10 !rounded-xl [&>button]:!bg-white/[0.05] [&>button]:!border-white/10 [&>button]:!text-white/60 [&>button:hover]:!bg-white/10" />
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as StickyNodeData;
                return IDEA_TYPE_STYLES[data.ideaType]?.miniMapColor || 'rgba(99, 102, 241, 0.4)';
              }}
              maskColor="rgba(6, 5, 14, 0.8)"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.04)" />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
