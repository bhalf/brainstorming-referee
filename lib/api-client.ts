/**
 * HTTP client for the FastAPI backend.
 * All API calls go through NEXT_PUBLIC_API_URL.
 * The frontend never writes directly to Supabase.
 */

import type {
  Session,
  SessionParticipant,
  SessionExport,
  CreateSessionFormData,
  JoinSessionResponse,
  Idea,
  Workspace,
  WorkspaceMember,
  WorkspaceMemberRole,
  ClusteredIdeasResponse,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, `${res.status} ${res.statusText}: ${body}`);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

// --- Sessions ---

export async function createSession(data: CreateSessionFormData): Promise<Session> {
  const payload = {
    title: data.title,
    description: data.description ?? '',
    language: data.language,
    moderation_level: data.moderation_level,
    features: data.features,
    goals: data.goals ?? [],
    planned_duration_minutes: data.planned_duration_minutes ?? null,
    config: data.config ?? {},
  };

  return request<Session>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getSessions(): Promise<Session[]> {
  return request<Session[]>('/api/sessions');
}

export async function getSession(id: string): Promise<Session> {
  return request<Session>(`/api/sessions/${id}`);
}

export async function endSession(id: string): Promise<void> {
  return request<void>(`/api/sessions/${id}/end`, {
    method: 'POST',
  });
}

export async function pauseSession(id: string, identity: string): Promise<Session> {
  return request<Session>(`/api/sessions/${id}/pause`, {
    method: 'POST',
    headers: { 'X-Livekit-Identity': identity },
  });
}

export async function resumeSession(id: string, identity: string): Promise<Session> {
  return request<Session>(`/api/sessions/${id}/resume`, {
    method: 'POST',
    headers: { 'X-Livekit-Identity': identity },
  });
}

// --- Session Management ---

export async function promoteToCoHost(sessionId: string, targetIdentity: string): Promise<SessionParticipant> {
  return request<SessionParticipant>(`/api/sessions/${sessionId}/promote`, {
    method: 'POST',
    body: JSON.stringify({ target_identity: targetIdentity }),
  });
}

export async function transferHost(sessionId: string, targetIdentity: string): Promise<SessionParticipant> {
  return request<SessionParticipant>(`/api/sessions/${sessionId}/transfer-host`, {
    method: 'POST',
    body: JSON.stringify({ target_identity: targetIdentity }),
  });
}

export async function getParticipants(sessionId: string): Promise<SessionParticipant[]> {
  return request<SessionParticipant[]>(`/api/participants/session/${sessionId}`);
}

// --- Join ---

export async function joinSession(code: string, displayName: string): Promise<JoinSessionResponse> {
  return request<JoinSessionResponse>('/api/sessions/join', {
    method: 'POST',
    body: JSON.stringify({ code, display_name: displayName }),
  });
}

// --- LiveKit ---

export async function getLivekitToken(sessionId: string, identity: string, displayName?: string): Promise<{ token: string; room: string; url: string }> {
  return request<{ token: string; room: string; url: string }>('/api/livekit/token', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, identity, display_name: displayName }),
  });
}

// --- Export ---

export async function exportSession(id: string): Promise<SessionExport> {
  return request<SessionExport>(`/api/sessions/${id}/export`);
}

// --- Ideas (interactive) ---

export async function createIdea(sessionId: string, data: { title: string; description?: string }): Promise<Idea> {
  return request<Idea>(`/api/sessions/${sessionId}/ideas`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateIdea(sessionId: string, ideaId: string, data: Partial<Pick<Idea, 'title' | 'description'>>): Promise<Idea> {
  return request<Idea>(`/api/sessions/${sessionId}/ideas/${ideaId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteIdea(sessionId: string, ideaId: string): Promise<void> {
  return request<void>(`/api/sessions/${sessionId}/ideas/${ideaId}`, {
    method: 'DELETE',
  });
}

export async function getIdeaClusters(sessionId: string): Promise<ClusteredIdeasResponse> {
  return request<ClusteredIdeasResponse>(`/api/sessions/${sessionId}/ideas/clusters`);
}

// --- Workspaces ---

export async function createWorkspace(data: { name: string; slug?: string }): Promise<Workspace> {
  return request<Workspace>('/api/workspaces', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getWorkspace(id: string): Promise<Workspace & { members: WorkspaceMember[] }> {
  return request<Workspace & { members: WorkspaceMember[] }>(`/api/workspaces/${id}`);
}

export async function getWorkspaceSessions(
  workspaceId: string,
  params?: { status?: string; limit?: number; offset?: number },
): Promise<Session[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return request<Session[]>(`/api/workspaces/${workspaceId}/sessions${qs ? `?${qs}` : ''}`);
}

export async function inviteMember(
  workspaceId: string,
  data: { email: string; role: WorkspaceMemberRole },
): Promise<{ invite_url: string }> {
  return request<{ invite_url: string }>(`/api/workspaces/${workspaceId}/invite`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function acceptInvite(token: string): Promise<WorkspaceMember> {
  return request<WorkspaceMember>('/api/workspaces/accept-invite', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceMemberRole,
): Promise<WorkspaceMember> {
  return request<WorkspaceMember>(`/api/workspaces/${workspaceId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  return request<void>(`/api/workspaces/${workspaceId}/members/${userId}`, {
    method: 'DELETE',
  });
}

export async function transferOwnership(workspaceId: string, targetUserId: string): Promise<Workspace> {
  return request<Workspace>(`/api/workspaces/${workspaceId}/transfer-ownership`, {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId }),
  });
}
