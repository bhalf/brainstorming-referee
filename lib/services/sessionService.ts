import { apiPost, apiGet, apiPatch, apiPut, apiFireAndForget } from './apiClient';
import type { ExperimentConfig, Scenario, VoiceSettings } from '@/lib/types';

// --- Types ---

interface CreateSessionParams {
    roomName: string;
    scenario: Scenario;
    language: string;
    config: ExperimentConfig;
    hostIdentity: string;
}

interface SessionInfo {
    sessionId: string;
    roomName: string;
    scenario: Scenario;
    language: string;
    config: ExperimentConfig;
    hostIdentity: string;
    startedAt: string;
}

// --- Service Functions ---

export async function createSession(params: CreateSessionParams): Promise<{ sessionId: string }> {
    return apiPost('/api/session', params);
}

export async function getSession(roomName: string): Promise<SessionInfo> {
    return apiGet('/api/session', { room: roomName });
}

export async function endSession(sessionId: string): Promise<void> {
    await apiPatch('/api/session', { sessionId });
}

export async function joinSession(roomName: string, participantName: string): Promise<SessionInfo | null> {
    try {
        return await apiGet('/api/session', { room: roomName });
    } catch {
        return null;
    }
}

export async function registerParticipant(
    sessionId: string,
    identity: string,
    displayName: string,
): Promise<void> {
    apiFireAndForget('/api/session/participants', {
        method: 'POST',
        body: JSON.stringify({ sessionId, identity, displayName }),
    });
}

export async function heartbeat(sessionId: string, identity: string): Promise<void> {
    apiFireAndForget('/api/session/participants', {
        method: 'PATCH',
        body: JSON.stringify({ sessionId, identity }),
    });
}

export async function updateVoiceSettings(
    sessionId: string,
    voiceSettings: Partial<VoiceSettings>,
): Promise<void> {
    await apiPut('/api/session', { sessionId, voiceSettings });
}
