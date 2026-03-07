'use client';

import { useState, useEffect } from 'react';
import { MetricSnapshot, ExperimentConfig, DecisionEngineState } from '@/lib/types';
import { checkThresholds, ThresholdBreaches } from '@/lib/metrics/computeMetrics';
import { DECISION_STATE_CONFIG, CONVERSATION_STATE_CONFIG, ENGINE_PHASE_CONFIG } from '@/lib/decision/stateConfig';
import { formatTime, formatPercent, formatSeconds } from '@/lib/utils/format';
import Panel from './shared/Panel';
import SectionHeader from './shared/SectionHeader';
import DebugMetricRow from './shared/DebugMetricRow';

interface DebugPanelProps {
  currentMetrics: MetricSnapshot | null;
  metricsHistory: MetricSnapshot[];
  config: ExperimentConfig;
  decisionState: DecisionEngineState;
  showConfig?: boolean;
}

export default function DebugPanel({
  currentMetrics,
  metricsHistory,
  config,
  decisionState,
  showConfig = false,
}: DebugPanelProps) {
  // Live-updating current time for cooldown display
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeOrDash = (timestamp: number | null | undefined): string =>
    timestamp ? formatTime(timestamp) : '—';

  const thresholds: ThresholdBreaches | null = currentMetrics
    ? checkThresholds(currentMetrics, config)
    : null;

  const stateColor = DECISION_STATE_CONFIG[decisionState.currentState]?.badgeColor ?? 'bg-slate-600';
  const inferredState = currentMetrics?.inferredState;
  const convStateConfig = inferredState ? CONVERSATION_STATE_CONFIG[inferredState.state] : null;
  const phase = decisionState.phase ?? 'MONITORING';
  const phaseConfig = ENGINE_PHASE_CONFIG[phase];

  return (
    <div className="h-full overflow-y-auto space-y-4 text-sm">
      {/* Inferred Conversation State (v2) */}
      {inferredState && convStateConfig && (
        <Panel>
          <SectionHeader>Conversation State</SectionHeader>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">State:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${convStateConfig.color}`}>
                {convStateConfig.label}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Confidence:</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      convStateConfig.severity === 'healthy' ? 'bg-green-500' :
                      convStateConfig.severity === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${inferredState.confidence * 100}%` }}
                  />
                </div>
                <span className="text-white text-xs">{(inferredState.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            {inferredState.secondaryState && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Secondary:</span>
                <span className="text-slate-300 text-xs">
                  {CONVERSATION_STATE_CONFIG[inferredState.secondaryState]?.label} ({(inferredState.secondaryConfidence * 100).toFixed(0)}%)
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Duration:</span>
              <span className="text-white text-xs">{(inferredState.durationMs / 1000).toFixed(0)}s</span>
            </div>
            <div className="text-xs text-slate-500 italic">{convStateConfig.description}</div>
          </div>
        </Panel>
      )}

      {/* Engine Phase (v2) + Decision Engine State */}
      <Panel>
        <SectionHeader>Decision Engine</SectionHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Phase:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${phaseConfig?.badgeColor ?? 'bg-slate-600'}`}>
              {phaseConfig?.label ?? phase}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Legacy State:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${stateColor}`}>
              {decisionState.currentState}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Interventions:</span>
            <span className="text-white">{decisionState.interventionCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Last Intervention:</span>
            <span className="text-white">{formatTimeOrDash(decisionState.lastInterventionTime)}</span>
          </div>
          {decisionState.cooldownUntil && currentTime < decisionState.cooldownUntil && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cooldown:</span>
              <span className="text-yellow-400">{Math.ceil((decisionState.cooldownUntil - currentTime) / 1000)}s</span>
            </div>
          )}
          {decisionState.confirmingSince && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Confirming:</span>
              <span className="text-blue-400">
                {decisionState.confirmingState} ({Math.ceil((currentTime - decisionState.confirmingSince) / 1000)}s / {config.CONFIRMATION_SECONDS}s)
              </span>
            </div>
          )}
          {decisionState.persistenceStartTime && !decisionState.confirmingSince && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Persistence Timer:</span>
              <span className="text-blue-400">{Math.ceil((currentTime - decisionState.persistenceStartTime) / 1000)}s / {config.PERSISTENCE_SECONDS}s</span>
            </div>
          )}
          {decisionState.postCheckStartTime && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Post-Check:</span>
              <span className="text-green-400">
                {Math.ceil((currentTime - decisionState.postCheckStartTime) / 1000)}s / {config.POST_CHECK_SECONDS}s
                {decisionState.postCheckIntent && <span className="text-slate-500 ml-1">({decisionState.postCheckIntent})</span>}
              </span>
            </div>
          )}
        </div>
      </Panel>

      {/* Participation Metrics (v2) */}
      {currentMetrics?.participation && (
        <Panel>
          <SectionHeader>Participation Metrics</SectionHeader>
          <div className="space-y-2">
            <DebugMetricRow
              label="Risk Score"
              value={formatPercent(currentMetrics.participation.participationRiskScore)}
              threshold={formatPercent(config.THRESHOLD_PARTICIPATION_RISK)}
              isBreached={currentMetrics.participation.participationRiskScore >= config.THRESHOLD_PARTICIPATION_RISK}
            />
            <DebugMetricRow
              label="Silent Ratio"
              value={formatPercent(currentMetrics.participation.silentParticipantRatio)}
              threshold={formatPercent(config.THRESHOLD_SILENT_PARTICIPANT)}
              isBreached={currentMetrics.participation.silentParticipantRatio > 0}
            />
            <DebugMetricRow
              label="Dominance Streak"
              value={formatPercent(currentMetrics.participation.dominanceStreakScore)}
              threshold="—"
              isBreached={currentMetrics.participation.dominanceStreakScore > 0.5}
            />
            <DebugMetricRow
              label="Imbalance (Gini)"
              value={formatPercent(currentMetrics.participationImbalance)}
              threshold={formatPercent(config.THRESHOLD_IMBALANCE)}
              isBreached={thresholds?.imbalance}
            />
          </div>
        </Panel>
      )}

      {/* Semantic Dynamics (v2) */}
      {currentMetrics?.semanticDynamics && (
        <Panel>
          <SectionHeader>Semantic Dynamics</SectionHeader>
          <div className="space-y-2">
            <DebugMetricRow
              label="Novelty Rate"
              value={formatPercent(currentMetrics.semanticDynamics.noveltyRate)}
              threshold={formatPercent(config.THRESHOLD_NOVELTY_RATE)}
              isBreached={currentMetrics.semanticDynamics.noveltyRate < config.THRESHOLD_NOVELTY_RATE}
            />
            <DebugMetricRow
              label="Cluster Concentration"
              value={formatPercent(currentMetrics.semanticDynamics.clusterConcentration)}
              threshold={formatPercent(config.THRESHOLD_CLUSTER_CONCENTRATION)}
              isBreached={currentMetrics.semanticDynamics.clusterConcentration >= config.THRESHOLD_CLUSTER_CONCENTRATION}
            />
            <DebugMetricRow
              label="Exploration Ratio"
              value={formatPercent(currentMetrics.semanticDynamics.explorationElaborationRatio)}
              threshold="—"
              isBreached={false}
            />
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs">Expansion Score:</span>
              <span className={`text-xs font-mono ${
                currentMetrics.semanticDynamics.semanticExpansionScore > 0 ? 'text-green-400' :
                currentMetrics.semanticDynamics.semanticExpansionScore < -0.1 ? 'text-red-400' : 'text-slate-300'
              }`}>
                {currentMetrics.semanticDynamics.semanticExpansionScore > 0 ? '+' : ''}
                {currentMetrics.semanticDynamics.semanticExpansionScore.toFixed(2)}
              </span>
            </div>
          </div>
        </Panel>
      )}

      {/* Legacy Metrics */}
      <Panel>
        <SectionHeader>Legacy Metrics</SectionHeader>
        {currentMetrics ? (
          <div className="space-y-2">
            <DebugMetricRow
              label="Semantic Repetition"
              value={formatPercent(currentMetrics.semanticRepetitionRate)}
              threshold={formatPercent(config.THRESHOLD_REPETITION)}
              isBreached={thresholds?.repetition}
            />
            <DebugMetricRow
              label="Stagnation Duration"
              value={formatSeconds(currentMetrics.stagnationDuration)}
              threshold={formatSeconds(config.THRESHOLD_STAGNATION_SECONDS)}
              isBreached={thresholds?.stagnation}
            />
            <DebugMetricRow
              label="Diversity (TTR)"
              value={formatPercent(currentMetrics.diversityDevelopment)}
              threshold="—"
              isBreached={false}
            />
          </div>
        ) : (
          <p className="text-slate-500 text-center py-2">No metrics yet</p>
        )}
      </Panel>

      {/* Speaking Time Distribution */}
      {currentMetrics && Object.keys(currentMetrics.speakingTimeDistribution).length > 0 && (
        <Panel>
          <SectionHeader>Speaking Distribution</SectionHeader>
          <div className="space-y-1.5">
            {Object.entries(currentMetrics.speakingTimeDistribution).map(([speaker, chars]) => {
              const total = Object.values(currentMetrics.speakingTimeDistribution).reduce((a, b) => a + b, 0);
              const percent = total > 0 ? (chars / total) * 100 : 0;
              return (
                <div key={speaker} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">{speaker}</span>
                    <span className="text-slate-400">{percent.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Metrics History */}
      {metricsHistory.length > 0 && (
        <Panel>
          <SectionHeader>History (Last {Math.min(metricsHistory.length, 10)})</SectionHeader>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {metricsHistory.slice(-10).reverse().map((snapshot) => (
              <div
                key={snapshot.id}
                className="flex items-center justify-between text-xs py-1 border-b border-slate-600/50 last:border-0"
              >
                <span className="text-slate-500">{formatTime(snapshot.timestamp)}</span>
                <div className="flex gap-1 items-center">
                  {snapshot.inferredState && (
                    <span className={`px-1 py-0.5 rounded text-[10px] text-white ${
                      CONVERSATION_STATE_CONFIG[snapshot.inferredState.state]?.color ?? 'bg-slate-600'
                    }`}>
                      {snapshot.inferredState.state.replace(/_/g, ' ').slice(0, 3)}
                    </span>
                  )}
                  <span className={snapshot.participationImbalance >= config.THRESHOLD_IMBALANCE ? 'text-red-400' : 'text-slate-400'}>
                    I:{formatPercent(snapshot.participationImbalance)}
                  </span>
                  <span className={snapshot.semanticRepetitionRate >= config.THRESHOLD_REPETITION ? 'text-red-400' : 'text-slate-400'}>
                    R:{formatPercent(snapshot.semanticRepetitionRate)}
                  </span>
                  <span className={snapshot.stagnationDuration >= config.THRESHOLD_STAGNATION_SECONDS ? 'text-red-400' : 'text-slate-400'}>
                    S:{snapshot.stagnationDuration.toFixed(0)}s
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Config (collapsible) */}
      {showConfig && (
        <Panel>
          <SectionHeader>Active Configuration</SectionHeader>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {Object.entries(config).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-slate-500 truncate mr-2">{key}:</span>
                <span className="text-slate-300">{value}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
