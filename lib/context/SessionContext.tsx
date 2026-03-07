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
} from '../types';
import { DEFAULT_CONFIG } from '../config';

// --- Initial States ---

const initialDecisionState: DecisionEngineState = {
  currentState: 'OBSERVATION',
  lastInterventionTime: null,
  interventionCount: 0,
  persistenceStartTime: null,
  postCheckStartTime: null,
  cooldownUntil: null,
  metricsAtIntervention: null,
  triggerAtIntervention: null,
  // v2 fields
  phase: 'MONITORING',
  confirmingSince: null,
  confirmingState: null,
  postCheckIntent: null,
};

const initialVoiceSettings: VoiceSettings = {
  voiceName: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 0.8,
  enabled: false,
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
        // Cap at 2000 entries to prevent unbounded memory growth in long sessions
        transcriptSegments: state.transcriptSegments.length >= 2000
          ? [...state.transcriptSegments.slice(-1999), action.payload]
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

    case 'ADD_METRIC_SNAPSHOT':
      return {
        ...state,
        // Cap at 200 entries (~16 min at 5s intervals) to prevent unbounded growth
        metricSnapshots: state.metricSnapshots.length >= 200
          ? [...state.metricSnapshots.slice(-199), action.payload]
          : [...state.metricSnapshots, action.payload],
      };

    case 'ADD_INTERVENTION':
      return {
        ...state,
        interventions: [...state.interventions, action.payload],
        decisionState: {
          ...state.decisionState,
          lastInterventionTime: action.payload.timestamp,
          interventionCount: state.decisionState.interventionCount + 1,
        },
      };

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
        modelRoutingLog: [...state.modelRoutingLog, action.payload],
      };

    case 'ADD_ERROR':
      return {
        ...state,
        errors: [
          ...state.errors,
          { timestamp: Date.now(), message: action.payload.message, context: action.payload.context },
        ],
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
  endSession: () => void;
  addTranscriptSegment: (segment: TranscriptSegment) => void;
  updateTranscriptSegment: (id: string, updates: Partial<TranscriptSegment>) => void;
  addMetricSnapshot: (snapshot: MetricSnapshot) => void;
  addIntervention: (intervention: Intervention) => void;
  updateIntervention: (id: string, updates: Partial<Intervention>) => void;
  updateDecisionState: (updates: Partial<DecisionEngineState>) => void;
  updateVoiceSettings: (updates: Partial<VoiceSettings>) => void;
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

  const endSession = useCallback(() => {
    dispatch({ type: 'END_SESSION' });
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

  const addError = useCallback((message: string, context?: string) => {
    dispatch({ type: 'ADD_ERROR', payload: { message, context } });
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
      voiceSettings: state.voiceSettings,
      modelRoutingLog: state.modelRoutingLog,
      errors: state.errors,
    };
  }, [state]);

  const value: SessionContextValue = {
    state,
    dispatch,
    startSession,
    setSessionId,
    endSession,
    addTranscriptSegment,
    updateTranscriptSegment,
    addMetricSnapshot,
    addIntervention,
    updateIntervention,
    updateDecisionState,
    updateVoiceSettings,
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

