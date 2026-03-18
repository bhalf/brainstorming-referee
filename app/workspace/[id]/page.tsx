'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getWorkspace,
  getWorkspaceSessions,
  inviteMember,
  updateMemberRole,
  removeMember,
  transferOwnership,
} from '@/lib/api-client';
import type { Session, Workspace, WorkspaceMember, WorkspaceMemberRole } from '@/types';

type SidebarTab = 'sessions' | 'members' | 'settings';

const ROLE_LABELS: Record<WorkspaceMemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Mitglied',
};

function memberDisplayName(member: WorkspaceMember): string {
  return member.display_name || member.email?.split('@')[0] || member.user_id;
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  professional: 'Professional',
  academic: 'Academic',
  enterprise: 'Enterprise',
};

// --- Invite Modal ---
function InviteModal({ workspaceId, onClose, onInvited }: {
  workspaceId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WorkspaceMemberRole>('member');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await inviteMember(workspaceId, { email: email.trim(), role });
      setInviteUrl(result.invite_url);
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Einladung fehlgeschlagen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass p-6 rounded-2xl max-w-md w-full mx-4">
        <h3 className="text-lg font-bold mb-4">Mitglied einladen</h3>

        {inviteUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Einladungslink erstellt:</p>
            <div className="glass-sm p-3 flex items-center gap-2">
              <code className="flex-1 text-xs text-[var(--text-tertiary)] break-all">{inviteUrl}</code>
              <button onClick={handleCopy} className="btn-glass text-xs px-3 py-1.5 shrink-0">
                {copied ? 'Kopiert!' : 'Kopieren'}
              </button>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">Link ist 7 Tage gültig.</p>
            <button onClick={onClose} className="btn-primary w-full py-2.5 text-sm">Schliessen</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@beispiel.ch"
                className="input-glass"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Rolle</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as WorkspaceMemberRole)}
                className="select-glass"
              >
                <option value="member">Mitglied</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <p className="text-sm text-rose-400">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-glass flex-1 py-2.5 text-sm">Abbrechen</button>
              <button type="submit" disabled={submitting || !email.trim()} className="btn-primary flex-1 py-2.5 text-sm">
                {submitting ? 'Sende...' : 'Einladen'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// --- Confirm Dialog ---
function ConfirmDialog({ title, message, onConfirm, onCancel, destructive }: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass p-6 rounded-2xl max-w-sm w-full mx-4">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-glass flex-1 py-2.5 text-sm">Abbrechen</button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition-all ${
              destructive
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20'
                : 'btn-primary'
            }`}
          >
            Bestätigen
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<(Workspace & { members: WorkspaceMember[] }) | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('sessions');
  const [showInvite, setShowInvite] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
    destructive?: boolean;
  } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [ws, sess] = await Promise.all([
        getWorkspace(workspaceId),
        getWorkspaceSessions(workspaceId),
      ]);
      setWorkspace(ws);
      setSessions(sess);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group sessions by status
  const activeSessions = sessions.filter((s) => s.status === 'active' || s.status === 'idle' || s.status === 'paused');
  const scheduledSessions = sessions.filter((s) => s.status === 'scheduled');
  const endedSessions = sessions.filter((s) => s.status === 'ended');

  // Current user role (simplified: assume first owner in members is current user — backend should provide this)
  const myRole = workspace?.members?.[0]?.role ?? 'member';
  const canManageMembers = myRole === 'owner' || myRole === 'admin';

  const handleRoleChange = async (userId: string, newRole: WorkspaceMemberRole) => {
    try {
      await updateMemberRole(workspaceId, userId, newRole);
      await loadData();
    } catch { /* best effort */ }
  };

  const handleRemoveMember = (member: WorkspaceMember) => {
    setConfirmAction({
      title: 'Mitglied entfernen',
      message: `Sind Sie sicher, dass Sie ${memberDisplayName(member)} aus dem Workspace entfernen möchten?`,
      destructive: true,
      action: async () => {
        await removeMember(workspaceId, member.user_id);
        await loadData();
      },
    });
  };

  const handleTransferOwnership = (member: WorkspaceMember) => {
    setConfirmAction({
      title: 'Ownership übertragen',
      message: `Sind Sie sicher? ${memberDisplayName(member)} wird Owner und Sie werden zum Admin heruntergestuft.`,
      destructive: false,
      action: async () => {
        await transferOwnership(workspaceId, member.user_id);
        await loadData();
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="min-h-screen bg-ambient flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <p className="text-rose-400 mb-4">{error || 'Workspace nicht gefunden'}</p>
          <button onClick={() => router.push('/dashboard')} className="btn-glass text-sm px-4 py-2">
            Zum Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ambient">
      {showInvite && (
        <InviteModal
          workspaceId={workspaceId}
          onClose={() => setShowInvite(false)}
          onInvited={loadData}
        />
      )}
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          destructive={confirmAction.destructive}
          onCancel={() => setConfirmAction(null)}
          onConfirm={async () => {
            await confirmAction.action();
            setConfirmAction(null);
          }}
        />
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm mb-2 transition-colors inline-flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Dashboard
            </button>
            <h1 className="text-2xl font-bold tracking-tight">{workspace.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-[var(--text-tertiary)] bg-white/[0.06] px-2 py-0.5 rounded-md font-mono">
                {workspace.slug}
              </span>
              <span className="text-xs text-[var(--text-tertiary)] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md">
                {PLAN_LABELS[workspace.plan] ?? workspace.plan}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="btn-primary text-sm px-5 py-2.5"
          >
            Neue Session
          </button>
        </div>

        <div className="flex gap-8 animate-fade-in">
          {/* Sidebar */}
          <nav className="w-48 shrink-0 space-y-1">
            {([
              { id: 'sessions' as const, label: 'Übersicht', icon: 'M4 6h16M4 12h16M4 18h12' },
              { id: 'members' as const, label: 'Mitglieder', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
              { id: 'settings' as const, label: 'Einstellungen', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-white/[0.04]'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
              <div className="space-y-6">
                {/* Active Sessions */}
                {activeSessions.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
                      Aktive Sessions <span className="opacity-60">{activeSessions.length}</span>
                    </h2>
                    <div className="space-y-2">
                      {activeSessions.map((s) => (
                        <SessionCard key={s.id} session={s} onClick={() => router.push(`/session/${s.id}`)} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Scheduled */}
                {scheduledSessions.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
                      Geplant <span className="opacity-60">{scheduledSessions.length}</span>
                    </h2>
                    <div className="space-y-2">
                      {scheduledSessions.map((s) => (
                        <SessionCard key={s.id} session={s} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Ended */}
                {endedSessions.length > 0 && (
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
                      Beendet <span className="opacity-60">{endedSessions.length}</span>
                    </h2>
                    <div className="space-y-2">
                      {endedSessions.map((s) => (
                        <SessionCard key={s.id} session={s} compact onClick={() => router.push(`/review/${s.id}`)} />
                      ))}
                    </div>
                  </section>
                )}

                {sessions.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-[var(--text-tertiary)] text-sm">Noch keine Sessions in diesem Workspace.</p>
                  </div>
                )}
              </div>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
                    {workspace.members.length} Mitglieder
                  </h2>
                  {canManageMembers && (
                    <button
                      onClick={() => setShowInvite(true)}
                      className="btn-primary text-xs px-4 py-2"
                    >
                      Mitglied einladen
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {workspace.members.map((member) => (
                    <div
                      key={member.user_id}
                      className="glass-sm p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-400">
                          {memberDisplayName(member).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{memberDisplayName(member)}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{member.email || member.user_id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {new Date(member.joined_at).toLocaleDateString('de-CH')}
                        </span>

                        {canManageMembers && member.role !== 'owner' ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.user_id, e.target.value as WorkspaceMemberRole)}
                            className="select-glass text-xs py-1 px-2 w-24"
                          >
                            <option value="member">Mitglied</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2.5 py-1 rounded-full ${
                            member.role === 'owner'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-white/5 text-[var(--text-tertiary)] border border-white/10'
                          }`}>
                            {ROLE_LABELS[member.role]}
                          </span>
                        )}

                        {canManageMembers && member.role !== 'owner' && (
                          <div className="flex items-center gap-1">
                            {myRole === 'owner' && (
                              <button
                                onClick={() => handleTransferOwnership(member)}
                                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors px-2 py-1"
                                title="Ownership übertragen"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.56 3.69a4 4 0 005.88 0M19 8l3 3-3 3M22 11H9" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member)}
                              className="text-xs text-[var(--text-tertiary)] hover:text-rose-400 transition-colors px-2 py-1"
                              title="Entfernen"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6 max-w-lg">
                <div className="glass-sm p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Workspace-Informationen</h2>
                  <div>
                    <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">Name</label>
                    <p className="text-sm text-[var(--text-primary)]">{workspace.name}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-tertiary)] mb-1.5">Slug</label>
                    <p className="text-sm font-mono text-[var(--text-primary)]">{workspace.slug}</p>
                  </div>
                </div>

                <div className="glass-sm p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Plan</h2>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-primary)]">
                      {PLAN_LABELS[workspace.plan] ?? workspace.plan}
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {workspace.sessions_this_month} / {workspace.max_sessions_per_month} Sessions diesen Monat
                    </span>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (workspace.sessions_this_month / workspace.max_sessions_per_month) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Max. {workspace.max_participants_per_session} Teilnehmer pro Session
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Session Card ---
function SessionCard({ session, onClick, compact }: {
  session: Session;
  onClick?: () => void;
  compact?: boolean;
}) {
  const isActive = session.status === 'active';
  const isIdle = session.status === 'idle';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => onClick && e.key === 'Enter' && onClick()}
      className={`glass-sm p-4 transition-all ${
        onClick ? 'glass-hover cursor-pointer' : ''
      } ${compact ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h3 className="font-medium text-sm text-[var(--text-primary)] truncate">{session.title}</h3>
            {isActive && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
            )}
            {isIdle && (
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-[var(--text-tertiary)]">
              {new Date(session.created_at).toLocaleDateString('de-CH', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
            {session.moderation_level !== 'none' && (
              <span className="text-xs text-[var(--text-tertiary)]">
                {session.moderation_level === 'moderation_ally' ? 'Moderation + Impuls' : 'Moderation'}
              </span>
            )}
          </div>
        </div>
        {!compact && (
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <span className="text-xs font-mono bg-white/[0.06] text-[var(--text-tertiary)] px-2 py-1 rounded-lg">
              {session.join_code}
            </span>
            {(isActive || isIdle) && (
              <span className="text-xs text-indigo-400 font-medium">Beitreten</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
