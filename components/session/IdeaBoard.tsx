'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Idea, IdeaConnection, IdeaType, NoveltyRole } from '@/types';
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
  addIdea: string;
  newIdea: string;
  noIdeas: string;
  editIdea: string;
  descriptionOptional: string;
  cancel: string;
  save: string;
  ungrouped: string;
  connectionHint: string;
}> = {
  de: {
    ideaBoard: 'Idea Board',
    ideas: 'Ideen',
    idea: 'Idee',
    addIdea: 'Idee hinzufügen',
    newIdea: 'Neue Idee...',
    noIdeas: 'Noch keine Ideen',
    editIdea: 'Idee bearbeiten',
    descriptionOptional: 'Beschreibung (optional)',
    cancel: 'Abbrechen',
    save: 'Speichern',
    ungrouped: 'Neue Ideen',
    connectionHint: 'Klicke auf eine Idee, um verwandte Ideen hervorzuheben.',
  },
  en: {
    ideaBoard: 'Idea Board',
    ideas: 'Ideas',
    idea: 'Idea',
    addIdea: 'Add idea',
    newIdea: 'New idea...',
    noIdeas: 'No ideas yet',
    editIdea: 'Edit idea',
    descriptionOptional: 'Description (optional)',
    cancel: 'Cancel',
    save: 'Save',
    ungrouped: 'New ideas',
    connectionHint: 'Click an idea to highlight related ideas.',
  },
  fr: {
    ideaBoard: 'Tableau d\'idées',
    ideas: 'Idées',
    idea: 'Idée',
    addIdea: 'Ajouter une idée',
    newIdea: 'Nouvelle idée...',
    noIdeas: 'Pas encore d\'idées',
    editIdea: 'Modifier l\'idée',
    descriptionOptional: 'Description (facultatif)',
    cancel: 'Annuler',
    save: 'Enregistrer',
    ungrouped: 'Nouvelles idées',
    connectionHint: 'Cliquez sur une idée pour mettre en avant les idées liées.',
  },
};

// ============================================================
// Styling
// ============================================================

const NOVELTY_STYLES: Record<NoveltyRole, { badge: string; icon: string; label: Record<LangKey, string> }> = {
  seed: { badge: 'bg-green-500/15 text-green-400 border-green-500/25', icon: '✦', label: { de: 'Neu', en: 'Seed', fr: 'Graine' } },
  extension: { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25', icon: '↗', label: { de: 'Erweiterung', en: 'Extension', fr: 'Extension' } },
  variant: { badge: 'bg-purple-500/15 text-purple-400 border-purple-500/25', icon: '≈', label: { de: 'Variante', en: 'Variant', fr: 'Variante' } },
  tangent: { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25', icon: '↝', label: { de: 'Verwandt', en: 'Related', fr: 'Connexe' } },
};

const TYPE_BORDER: Record<IdeaType, string> = {
  brainstorming_idea: 'border-l-indigo-500/40',
  ally_intervention: 'border-l-emerald-500/40',
  action_item: 'border-l-amber-500/40',
};

const GROUP_COLORS = [
  { header: 'from-indigo-500/15 to-violet-500/10', border: 'border-indigo-500/20', text: 'text-indigo-400', count: 'bg-indigo-500/15 text-indigo-300' },
  { header: 'from-emerald-500/15 to-teal-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', count: 'bg-emerald-500/15 text-emerald-300' },
  { header: 'from-amber-500/15 to-orange-500/10', border: 'border-amber-500/20', text: 'text-amber-400', count: 'bg-amber-500/15 text-amber-300' },
  { header: 'from-rose-500/15 to-pink-500/10', border: 'border-rose-500/20', text: 'text-rose-400', count: 'bg-rose-500/15 text-rose-300' },
  { header: 'from-cyan-500/15 to-blue-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', count: 'bg-cyan-500/15 text-cyan-300' },
];

// ============================================================
// Grouping by connected components
// ============================================================

interface IdeaGroup {
  label: string;
  ideas: Idea[];
}

function groupByConnections(ideas: Idea[], connections: IdeaConnection[]): IdeaGroup[] {
  if (ideas.length === 0) return [];

  const idSet = new Set(ideas.map((i) => i.id));

  // Build adjacency list
  const adj = new Map<string, Set<string>>();
  for (const id of idSet) adj.set(id, new Set());
  for (const conn of connections) {
    if (idSet.has(conn.source_idea_id) && idSet.has(conn.target_idea_id)) {
      adj.get(conn.source_idea_id)!.add(conn.target_idea_id);
      adj.get(conn.target_idea_id)!.add(conn.source_idea_id);
    }
  }

  // BFS to find connected components
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const id of idSet) {
    if (visited.has(id)) continue;
    const component: string[] = [];
    const queue = [id];
    visited.add(id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const neighbor of adj.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  // Sort components: larger groups first, then by earliest idea
  const ideaMap = new Map(ideas.map((i) => [i.id, i]));
  components.sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length;
    const aTime = Math.min(...a.map((id) => new Date(ideaMap.get(id)!.created_at).getTime()));
    const bTime = Math.min(...b.map((id) => new Date(ideaMap.get(id)!.created_at).getTime()));
    return aTime - bTime;
  });

  // Build groups
  const groups: IdeaGroup[] = [];
  const ungrouped: Idea[] = [];

  for (const component of components) {
    const groupIdeas = component
      .map((id) => ideaMap.get(id)!)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (component.length === 1) {
      ungrouped.push(groupIdeas[0]);
    } else {
      // Use the seed idea (or first idea) as group label
      const seedIdea = groupIdeas.find((i) => i.novelty_role === 'seed') || groupIdeas[0];
      groups.push({ label: seedIdea.title, ideas: groupIdeas });
    }
  }

  if (ungrouped.length > 0) {
    // Don't create an "ungrouped" section if there are no groups — just show all as one flat list
    if (groups.length === 0) {
      groups.push({ label: '', ideas: ungrouped });
    } else {
      groups.push({ label: '__ungrouped__', ideas: ungrouped });
    }
  }

  return groups;
}

// ============================================================
// Main Component
// ============================================================

export default function IdeaBoard({ ideas, connections, sessionId, language, readOnly }: IdeaBoardProps) {
  const langKey = resolveLang(language);
  const t = I18N[langKey];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);

  const visibleIdeas = useMemo(() => ideas.filter((i) => !i.is_deleted), [ideas]);
  const groups = useMemo(() => groupByConnections(visibleIdeas, connections), [visibleIdeas, connections]);

  // Connection lookup for highlight
  const connectedIds = useMemo(() => {
    if (!selectedIdeaId) return new Set<string>();
    const set = new Set<string>();
    for (const conn of connections) {
      if (conn.source_idea_id === selectedIdeaId) set.add(conn.target_idea_id);
      if (conn.target_idea_id === selectedIdeaId) set.add(conn.source_idea_id);
    }
    return set;
  }, [selectedIdeaId, connections]);

  // Connection count per idea
  const ideaConnectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const conn of connections) {
      counts[conn.source_idea_id] = (counts[conn.source_idea_id] || 0) + 1;
      counts[conn.target_idea_id] = (counts[conn.target_idea_id] || 0) + 1;
    }
    return counts;
  }, [connections]);

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
            ({visibleIdeas.length} {visibleIdeas.length !== 1 ? t.ideas : t.idea})
          </span>
        </div>
      </div>

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

      {/* Connection hint */}
      {connections.length > 0 && (
        <p className="shrink-0 text-[10px] text-[var(--text-tertiary)] px-3 pt-1.5 pb-0.5">
          {t.connectionHint}
        </p>
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

      {/* Idea clusters */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {visibleIdeas.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[var(--text-tertiary)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-50">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm">{t.noIdeas}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {groups.map((group, gi) => {
              const isUngrouped = group.label === '__ungrouped__';
              const isSingleFlat = group.label === '';
              const color = GROUP_COLORS[gi % GROUP_COLORS.length];

              if (isSingleFlat) {
                // All ideas are isolated — render in a compact grid instead of
                // a single long vertical list
                return (
                  <div key="flat" className="col-span-full grid grid-cols-2 gap-2">
                    {group.ideas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        langKey={langKey}
                        readOnly={readOnly}
                        connectionCount={ideaConnectionCounts[idea.id] || 0}
                        selected={selectedIdeaId === idea.id}
                        highlighted={connectedIds.has(idea.id)}
                        dimmed={selectedIdeaId !== null && selectedIdeaId !== idea.id && !connectedIds.has(idea.id)}
                        onClick={() => setSelectedIdeaId((prev) => (prev === idea.id ? null : idea.id))}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                );
              }

              return (
                <div key={gi} className={`rounded-xl overflow-hidden border ${isUngrouped ? 'border-white/10' : color.border}`}>
                  {/* Group header */}
                  <div className={`px-3 py-2 flex items-center justify-between ${isUngrouped ? 'bg-gradient-to-r from-white/[0.04] to-white/[0.02]' : `bg-gradient-to-r ${color.header}`}`}>
                    <h4 className={`text-xs font-semibold truncate ${isUngrouped ? 'text-[var(--text-tertiary)]' : color.text}`}>
                      {isUngrouped ? t.ungrouped : group.label}
                    </h4>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${isUngrouped ? 'bg-white/[0.06] text-[var(--text-tertiary)]' : color.count}`}>
                      {group.ideas.length}
                    </span>
                  </div>

                  {/* Ideas */}
                  <div className="p-2 space-y-1.5">
                    {group.ideas.map((idea) => (
                      <IdeaCard
                        key={idea.id}
                        idea={idea}
                        langKey={langKey}
                        readOnly={readOnly}
                        connectionCount={ideaConnectionCounts[idea.id] || 0}
                        selected={selectedIdeaId === idea.id}
                        highlighted={connectedIds.has(idea.id)}
                        dimmed={selectedIdeaId !== null && selectedIdeaId !== idea.id && !connectedIds.has(idea.id)}
                        onClick={() => setSelectedIdeaId((prev) => (prev === idea.id ? null : idea.id))}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Idea Card
// ============================================================

interface IdeaCardProps {
  idea: Idea;
  langKey: LangKey;
  readOnly?: boolean;
  connectionCount: number;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  onClick: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function IdeaCard({ idea, langKey, readOnly, connectionCount, selected, highlighted, dimmed, onClick, onEdit, onDelete }: IdeaCardProps) {
  const typeColor = TYPE_BORDER[idea.idea_type] || TYPE_BORDER.brainstorming_idea;
  const novelty = idea.novelty_role ? NOVELTY_STYLES[idea.novelty_role] : null;

  return (
    <div
      onClick={onClick}
      className={`
        border-l-[3px] ${typeColor} rounded-lg px-2.5 py-2 cursor-pointer transition-all duration-200
        ${selected
          ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30'
          : highlighted
            ? 'bg-white/[0.08] ring-1 ring-amber-400/30'
            : 'bg-white/[0.03] hover:bg-white/[0.06]'
        }
        ${dimmed ? 'opacity-30' : 'opacity-100'}
      `}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-0.5 flex-wrap">
            {novelty && (
              <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded border inline-block ${novelty.badge}`}>
                {novelty.icon} {novelty.label[langKey]}
              </span>
            )}
            {connectionCount > 0 && (
              <span className="text-[8px] font-medium px-1 py-0.5 rounded bg-white/[0.06] text-[var(--text-tertiary)] inline-block">
                {connectionCount}
              </span>
            )}
          </div>
          <h5 className="text-[12px] font-medium text-[var(--text-primary)] leading-snug">{idea.title}</h5>
          {idea.description && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2 leading-relaxed">{idea.description}</p>
          )}
          {idea.author_name && (
            <p className="text-[9px] text-[var(--text-tertiary)] mt-1 font-mono opacity-60">— {idea.author_name}</p>
          )}
        </div>
        {!readOnly && (
          <div className="flex gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(idea.id); }}
              className="text-[var(--text-tertiary)] hover:text-indigo-400 text-xs p-1 rounded-md hover:bg-white/[0.06] transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(idea.id); }}
              className="text-[var(--text-tertiary)] hover:text-rose-400 text-xs p-1 rounded-md hover:bg-white/[0.06] transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
