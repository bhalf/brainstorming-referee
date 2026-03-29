'use client';

import { useState, useMemo } from 'react';
import type { IACode, IACodeWithChildren } from '@/types/interview-analysis';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

const CODE_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#F59E0B', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6', '#6B7280', '#92400E',
];

interface CodebookPanelProps {
  codes: IACode[];
  assignmentCounts: Map<string, number>;
  selectedCodeId: string | null;
  onSelectCode: (code: IACode | null) => void;
  onCreateCode: (name: string, parentId: string | null, color: string) => Promise<void>;
  onUpdateCode: (id: string, updates: Partial<IACode>) => Promise<void>;
  onDeleteCode: (id: string) => Promise<void>;
}

function buildCodeTree(codes: IACode[]): IACodeWithChildren[] {
  const map = new Map<string | null, IACode[]>();
  for (const c of codes) {
    const parentKey = c.parent_id ?? null;
    const siblings = map.get(parentKey) ?? [];
    siblings.push(c);
    map.set(parentKey, siblings);
  }
  function buildLevel(parentId: string | null): IACodeWithChildren[] {
    return (map.get(parentId) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => ({ ...c, children: buildLevel(c.id) }));
  }
  return buildLevel(null);
}

export default function CodebookPanel({
  codes,
  assignmentCounts,
  selectedCodeId,
  onSelectCode,
  onCreateCode,
  onUpdateCode,
  onDeleteCode,
}: CodebookPanelProps) {
  const lang = useIALang();
  const tree = useMemo(() => buildCodeTree(codes), [codes]);
  const [addingParentId, setAddingParentId] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CODE_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  async function handleAdd() {
    if (!newName.trim()) return;
    await onCreateCode(newName.trim(), addingParentId ?? null, newColor);
    setNewName('');
    setNewColor(CODE_COLORS[Math.floor(Math.random() * CODE_COLORS.length)]);
    setAddingParentId(undefined);
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return;
    await onUpdateCode(id, { name: editName.trim() });
    setEditingId(null);
  }

  function renderTree(nodes: IACodeWithChildren[], depth: number) {
    return nodes.map(node => {
      const count = assignmentCounts.get(node.id) ?? 0;
      const isSelected = selectedCodeId === node.id;
      const isEditing = editingId === node.id;

      return (
        <div key={node.id} style={{ marginLeft: depth * 16 }}>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group transition-colors ${isSelected ? '' : 'hover:opacity-80'}`}
            style={{
              backgroundColor: isSelected ? `${node.color}18` : undefined,
              border: isSelected ? `1px solid ${node.color}40` : '1px solid transparent',
            }}
            onClick={() => onSelectCode(isSelected ? null : node)}
          >
            {/* Color dot */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 cursor-pointer"
              style={{ backgroundColor: node.color }}
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(showColorPicker === node.id ? null : node.id); }}
            />

            {/* Name */}
            {isEditing ? (
              <input
                className="ia-input flex-1 text-xs py-0.5 px-1"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRename(node.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={() => handleRename(node.id)}
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="flex-1 text-xs truncate"
                style={{ color: 'var(--ia-text)', fontWeight: node.children.length > 0 ? 600 : 400 }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingId(node.id); setEditName(node.name); }}
              >
                {node.name}
              </span>
            )}

            {/* Count badge */}
            {count > 0 && (
              <span className="ia-badge ia-badge-neutral" style={{ fontSize: '10px' }}>{count}</span>
            )}

            {/* Hover actions */}
            <div className="hidden group-hover:flex items-center gap-0.5">
              {/* Add child */}
              <button
                className="ia-btn ia-btn-ghost p-0.5"
                title={t('coding_add_code', lang)}
                onClick={(e) => {
                  e.stopPropagation();
                  setAddingParentId(node.id);
                  setNewColor(CODE_COLORS[Math.floor(Math.random() * CODE_COLORS.length)]);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              {/* Delete */}
              <button
                className="ia-btn ia-btn-ghost p-0.5"
                title={t('coding_delete_code', lang)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(t('coding_delete_confirm', lang))) {
                    onDeleteCode(node.id);
                  }
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Color picker */}
          {showColorPicker === node.id && (
            <div className="ia-popover flex flex-wrap gap-1 ml-5" onClick={e => e.stopPropagation()}>
              {CODE_COLORS.map(color => (
                <button
                  key={color}
                  className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: color,
                    borderColor: node.color === color ? 'var(--ia-text)' : 'transparent',
                  }}
                  onClick={() => { onUpdateCode(node.id, { color }); setShowColorPicker(null); }}
                />
              ))}
            </div>
          )}

          {/* Inline add form for children */}
          {addingParentId === node.id && (
            <div className="flex items-center gap-1 px-2 py-1 ml-4">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: newColor }}
              />
              <input
                className="ia-input flex-1 text-xs py-0.5 px-1"
                placeholder={t('coding_name_placeholder', lang)}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') setAddingParentId(undefined);
                }}
                autoFocus
              />
              <button className="ia-btn ia-btn-primary ia-btn-sm py-0.5 px-2 text-xs" onClick={handleAdd}>
                +
              </button>
            </div>
          )}

          {/* Children */}
          {node.children.length > 0 && renderTree(node.children, depth + 1)}
        </div>
      );
    });
  }

  return (
    <div className="ia-card p-3 flex flex-col gap-2" style={{ minWidth: 240, maxWidth: 280 }}>
      <div className="ia-section-header">
        <h3 className="ia-section-title">
          {t('coding_codebook', lang)}
        </h3>
        <span className="ia-badge ia-badge-neutral" style={{ fontSize: '10px' }}>
          {codes.length}
        </span>
      </div>

      {/* Code tree */}
      {tree.length > 0 ? (
        <div className="flex flex-col gap-0.5 ia-scroll-y" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {renderTree(tree, 0)}
        </div>
      ) : (
        <p className="text-xs text-center py-4" style={{ color: 'var(--ia-text-tertiary)' }}>
          {t('coding_no_codes', lang)}
        </p>
      )}

      {/* Root-level add button / form */}
      {addingParentId === null ? (
        <div className="flex items-center gap-1 mt-1">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: newColor }}
          />
          <input
            className="ia-input flex-1 text-xs py-1 px-2"
            placeholder={t('coding_name_placeholder', lang)}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setAddingParentId(undefined); setNewName(''); }
            }}
            autoFocus
          />
          <button className="ia-btn ia-btn-primary ia-btn-sm py-1 px-2 text-xs" onClick={handleAdd}>
            +
          </button>
        </div>
      ) : addingParentId === undefined ? (
        <button
          className="ia-btn ia-btn-ghost ia-btn-sm w-full text-xs flex items-center justify-center gap-1 mt-1"
          onClick={() => {
            setAddingParentId(null);
            setNewColor(CODE_COLORS[Math.floor(Math.random() * CODE_COLORS.length)]);
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('coding_add_code', lang)}
        </button>
      ) : null}
    </div>
  );
}
