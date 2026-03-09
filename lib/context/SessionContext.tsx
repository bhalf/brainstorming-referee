'use client';

import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import {
  SessionState,
  ExperimentConfig,
  Scenario,
  TranscriptSegment,
  MetricSnapshot,
  Intervention,
  DecisionEngineState,
  VoiceSettings,
  SessionLog,
  ModelRoutingLogEntry,
  Idea,
  IdeaConnection,
} from '../types';
import { DEFAULT_CONFIG } from '../config';
import { PROMPT_VERSION } from '../config/promptVersion';

// --- Initial States ---

const initialDecisionState: DecisionEngineState = {
  phase: 'MONITORING',
  lastInterventionTime: null,
  interventionCount: 0,
  postCheckStartTime: null,
  cooldownUntil: null,
  metricsAtIntervention: null,
  confirmingSince: null,
  confirmingState: null,
  postCheckIntent: null,
  lastRuleViolationTime: null,
};

const initialVoiceSettings: VoiceSettings = {
  voiceName: 'nova',
  rate: 1.0,
  pitch: 1.0,
  volume: 0.8,
  enabled: true,
};

const initialSessionState: SessionState = {
  sessionId: null,
  roomName: '',
  scenario: 'baseline',
  language: 'en-US',
  isActive: false,
  startTime: null,
  config: DEFAULT_CONFIG,
  transcriptSegments: [],
  metricSnapshots: [],
  interventions: [],
  ideas: [],
  ideaConnections: [],
  decisionState: initialDecisionState,
  voiceSettings: initialVoiceSettings,
  modelRoutingLog: [],
  errors: [],
};

// --- Action Types ---

type SessionAction =
  | { type: 'START_SESSION'; payload: { roomName: string; scenario: Scenario; language: string; config: ExperimentConfig; sessionId?: string } }
  | { type: 'END_SESSION' }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'UPDATE_CONFIG'; payload: Partial<ExperimentConfig> }
  | { type: 'ADD_TRANSCRIPT_SEGMENT'; payload: TranscriptSegment }
  | { type: 'UPDATE_TRANSCRIPT_SEGMENT'; payload: { id: string; updates: Partial<TranscriptSegment> } }
  | { type: 'ADD_METRIC_SNAPSHOT'; payload: MetricSnapshot }
  | { type: 'ADD_INTERVENTION'; payload: Intervention }
  | { type: 'UPDATE_INTERVENTION'; payload: { id: string; updates: Partial<Intervention> } }
  | { type: 'UPDATE_DECISION_STATE'; payload: Partial<DecisionEngineState> }
  | { type: 'UPDATE_VOICE_SETTINGS'; payload: Partial<VoiceSettings> }
  | { type: 'ADD_MODEL_ROUTING_LOG'; payload: ModelRoutingLogEntry }
  | { type: 'ADD_IDEA'; payload: Idea }
  | { type: 'UPDATE_IDEA'; payload: { id: string; updates: Partial<Idea> } }
  | { type: 'REMOVE_IDEA'; payload: string }
  | { type: 'ADD_IDEA_CONNECTION'; payload: IdeaConnection }
  | { type: 'ADD_ERROR'; payload: { message: string; context?: string } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'RESET_SESSION' };

// --- Reducer ---

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'START_SESSION':
      return {
        ...state,
        sessionId: action.payload.sessionId ?? null,
        roomName: action.payload.roomName,
        scenario: action.payload.scenario,
        language: action.payload.language,
        config: action.payload.config,
        isActive: true,
        startTime: Date.now(),
        transcriptSegments: [],
        metricSnapshots: [],
        interventions: [],
        ideas: [],
        ideaConnections: [],
        decisionState: initialDecisionState,
        modelRoutingLog: [],
        errors: [],
      };

    case 'SET_SESSION_ID':
      return {
        ...state,
        sessionId: action.payload,
      };

    case 'END_SESSION':
      return {
        ...state,
        isActive: false,
      };

    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: { ...state.config, ...action.payload },
      };

    case 'ADD_TRANSCRIPT_SEGMENT': {
      // Deduplicate by segment ID to prevent double-adds from sync polling
      if (state.transcriptSegments.some(s => s.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        // Cap at 5000 entries (~60 min of active discussion) to prevent unbounded growth
        transcriptSegments: state.transcriptSegments.length >= 5000
          ? [...state.transcriptSegments.slice(-4999), action.payload]
          : [...state.transcriptSegments, action.payload],
      };
    }

    case 'UPDATE_TRANSCRIPT_SEGMENT':
      return {
        ...state,
        transcriptSegments: state.transcriptSegments.map((seg) =>
          seg.id === action.payload.id ? { ...seg, ...action.payload.updates } : seg
        ),
      };

    case 'ADD_METRIC_SNAPSHOT': {
      // Deduplicate by ID first, fall back to timestamp (prevents double-add from owner + Realtime)
      if (action.payload.id && state.metricSnapshots.some(s => s.id === action.payload.id)) {
        return state;
      }
      if (state.metricSnapshots.some(s => s.timestamp === action.payload.timestamp)) {
        return state;
      }
      return {
        ...state,
        // Cap at 720 entries (~60 min at 5s intervals) to prevent unbounded growth
        metricSnapshots: state.metricSnapshots.length >= 720
          ? [...state.metricSnapshots.slice(-719), action.payload]
          : [...state.metricSnapshots, action.payload],
      };
    }

    case 'ADD_INTERVENTION': {
      // Deduplicate by intervention ID (prevents double-add from Realtime sync)
      if (state.interventions.some(i => i.id === action.payload.id)) {
        return state;
      }
      // Note: interventionCount is managed by the decision engine via UPDATE_DECISION_STATE.
      // Do NOT increment it here — that would double-count (engine + reducer).
      return {
        ...state,
        interventions: [...state.interventions, action.payload],
      };
    }

    case 'UPDATE_INTERVENTION':
      return {
        ...state,
        interventions: state.interventions.map((int) =>
          int.id === action.payload.id ? { ...int, ...action.payload.updates } : int
        ),
      };

    case 'UPDATE_DECISION_STATE':
      return {
        ...state,
        decisionState: { ...state.decisionState, ...action.payload },
      };

    case 'UPDATE_VOICE_SETTINGS':
      return {
        ...state,
        voiceSettings: { ...state.voiceSettings, ...action.payload },
      };

    case 'ADD_MODEL_ROUTING_LOG':
      return {
        ...state,
        // Cap at 500 entries to prevent unbounded growth
        modelRoutingLog: state.modelRoutingLog.length >= 500
          ? [...state.modelRoutingLog.slice(-499), action.payload]
          : [...state.modelRoutingLog, action.payload],
      };

    case 'ADD_IDEA': {
      if (state.ideas.some(i => i.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        ideas: state.ideas.length >= 500
          ? [...state.ideas.slice(-499), action.payload]
          : [...state.ideas, action.payload],
      };
    }

    case 'UPDATE_IDEA':
      return {
        ...state,
        ideas: state.ideas.map((idea) =>
          idea.id === action.payload.id ? { ...idea, ...action.payload.updates } : idea
        ),
      };

    case 'REMOVE_IDEA':
      return {
        ...state,
        ideas: state.ideas.map((idea) =>
          idea.id === action.payload ? { ...idea, isDeleted: true } : idea
        ),
      };

    case 'ADD_IDEA_CONNECTION': {
      if (state.ideaConnections.some(c => c.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        // Cap at 1000 entries to prevent unbounded growth
        ideaConnections: state.ideaConnections.length >= 1000
          ? [...state.ideaConnections.slice(-999), action.payload]
          : [...state.ideaConnections, action.payload],
      };
    }

    case 'ADD_ERROR':
      return {
        ...state,
        // Cap at 100 entries to prevent unbounded growth
        errors: state.errors.length >= 100
          ? [...state.errors.slice(-99), { timestamp: Date.now(), message: action.payload.message, context: action.payload.context }]
          : [...state.errors, { timestamp: Date.now(), message: action.payload.message, context: action.payload.context }],
      };

    case 'CLEAR_ERRORS':
      return {
        ...state,
        errors: [],
      };

    case 'RESET_SESSION':
      return initialSessionState;

    default:
      return state;
  }
}

// --- Context ---

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;

  // Convenience methods
  startSession: (roomName: string, scenario: Scenario, language: string, config: ExperimentConfig, sessionId?: string) => void;
  setSessionId: (sessionId: string) => void;
  endSession: (sessionId?: string | null) => void;
  updateConfig: (updates: Partial<ExperimentConfig>) => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  updateTranscriptSegment: (id: string, updates: Partial<TranscriptSegment>) => void;
  addMetricSnapshot: (snapshot: MetricSnapshot) => void;
  addIntervention: (intervention: Intervention) => void;
  updateIntervention: (id: string, updates: Partial<Intervention>) => void;
  updateDecisionState: (updates: Partial<DecisionEngineState>) => void;
  updateVoiceSettings: (updates: Partial<VoiceSettings>) => void;
  addIdea: (idea: Idea) => void;
  updateIdea: (id: string, updates: Partial<Idea>) => void;
  removeIdea: (id: string) => void;
  addIdeaConnection: (connection: IdeaConnection) => void;
  addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
  addError: (message: string, context?: string) => void;
  exportSessionLog: () => SessionLog;
}

const SessionContext = createContext<SessionContextValue | null>(null);

// --- Provider ---

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);

  const startSession = useCallback(
    (roomName: string, scenario: Scenario, language: string, config: ExperimentConfig, sessionId?: string) => {
      dispatch({ type: 'START_SESSION', payload: { roomName, scenario, language, config, sessionId } });
    },
    []
  );

  const setSessionId = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
  }, []);

  const endSession = useCallback((sessionId?: string | null) => {
    // Persist to server if sessionId is provided
    if (sessionId) {
      fetch('/api/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        keepalive: true, // Ensures request completes even during navigation
      }).catch(() => { }); // best-effort
    }
    dispatch({ type: 'END_SESSION' });
  }, []);

  const updateConfig = useCallback((updates: Partial<ExperimentConfig>) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: updates });
  }, []);

  const addTranscriptSegment = useCallback((segment: TranscriptSegment) => {
    dispatch({ type: 'ADD_TRANSCRIPT_SEGMENT', payload: segment });
  }, []);

  const updateTranscriptSegment = useCallback((id: string, updates: Partial<TranscriptSegment>) => {
    dispatch({ type: 'UPDATE_TRANSCRIPT_SEGMENT', payload: { id, updates } });
  }, []);

  const addMetricSnapshot = useCallback((snapshot: MetricSnapshot) => {
    dispatch({ type: 'ADD_METRIC_SNAPSHOT', payload: snapshot });
  }, []);

  const addIntervention = useCallback((intervention: Intervention) => {
    dispatch({ type: 'ADD_INTERVENTION', payload: intervention });
  }, []);

  const updateIntervention = useCallback((id: string, updates: Partial<Intervention>) => {
    dispatch({ type: 'UPDATE_INTERVENTION', payload: { id, updates } });
  }, []);

  const updateDecisionState = useCallback((updates: Partial<DecisionEngineState>) => {
    dispatch({ type: 'UPDATE_DECISION_STATE', payload: updates });
  }, []);

  const updateVoiceSettings = useCallback((updates: Partial<VoiceSettings>) => {
    dispatch({ type: 'UPDATE_VOICE_SETTINGS', payload: updates });
  }, []);

  const addIdea = useCallback((idea: Idea) => {
    dispatch({ type: 'ADD_IDEA', payload: idea });
  }, []);

  const updateIdea = useCallback((id: string, updates: Partial<Idea>) => {
    dispatch({ type: 'UPDATE_IDEA', payload: { id, updates } });
  }, []);

  const removeIdea = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_IDEA', payload: id });
  }, []);

  const addIdeaConnection = useCallback((connection: IdeaConnection) => {
    dispatch({ type: 'ADD_IDEA_CONNECTION', payload: connection });
  }, []);

  const sessionIdRef = React.useRef<string | null>(null);
  React.useEffect(() => { sessionIdRef.current = state.sessionId; }, [state.sessionId]);

  const addError = useCallback((message: string, context?: string) => {
    dispatch({ type: 'ADD_ERROR', payload: { message, context } });
    // Fire-and-forget persist to DB
    const sid = sessionIdRef.current;
    if (sid) {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, timestamp: Date.now(), message, context }),
      }).catch(() => { }); // best-effort
    }
  }, []);

  const addModelRoutingLog = useCallback((entry: ModelRoutingLogEntry) => {
    dispatch({ type: 'ADD_MODEL_ROUTING_LOG', payload: entry });
  }, []);

  const exportSessionLog = useCallback((): SessionLog => {
    return {
      metadata: {
        roomName: state.roomName,
        scenario: state.scenario,
        startTime: state.startTime || Date.now(),
        endTime: state.isActive ? null : Date.now(),
        language: state.language,
      },
      activeConfig: state.config,
      transcriptSegments: state.transcriptSegments,
      metricSnapshots: state.metricSnapshots,
      interventions: state.interventions,
      ideas: state.ideas.filter(i => !i.isDeleted),
      ideaConnections: state.ideaConnections,
      voiceSettings: state.voiceSettings,
      modelRoutingLog: state.modelRoutingLog,
      errors: state.errors,
      promptVersion: PROMPT_VERSION,
    };
  }, [state]);

  const value: SessionContextValue = {
    state,
    dispatch,
    startSession,
    setSessionId,
    endSession,
    updateConfig,
    addTranscriptSegment,
    updateTranscriptSegment,
    addMetricSnapshot,
    addIntervention,
    updateIntervention,
    updateDecisionState,
    updateVoiceSettings,
    addIdea,
    updateIdea,
    removeIdea,
    addIdeaConnection,
    addModelRoutingLog,
    addError,
    exportSessionLog,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// --- Hook ---

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

