'use client';

import { useState, useEffect } from 'react';
import { MetricSnapshot, ExperimentConfig, DecisionEngineState } from '@/lib/types';
import { checkThresholds, ThresholdBreaches } from '@/lib/metrics/computeMetrics';

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
    setCurrentTime(Date.now()); // Set initial time on mount
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatSeconds = (value: number): string => {
    return `${value.toFixed(1)}s`;
  };

  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const thresholds: ThresholdBreaches | null = currentMetrics
    ? checkThresholds(currentMetrics, config)
    : null;

  const stateColors: Record<string, string> = {
    OBSERVATION: 'bg-green-600',
    STABILIZATION: 'bg-yellow-600',
    ESCALATION: 'bg-red-600',
  };

  return (
    <div className="h-full overflow-y-auto space-y-4 text-sm">
      {/* Decision Engine State */}
      <section className="bg-slate-700/30 rounded-lg p-3">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
          Decision Engine
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">State:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${stateColors[decisionState.currentState]}`}>
              {decisionState.currentState}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Interventions:</span>
            <span className="text-white">{decisionState.interventionCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Last Intervention:</span>
            <span className="text-white">{formatTime(decisionState.lastInterventionTime)}</span>
          </div>
          {decisionState.cooldownUntil && currentTime < decisionState.cooldownUntil && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cooldown:</span>
              <span className="text-yellow-400">{Math.ceil((decisionState.cooldownUntil - currentTime) / 1000)}s</span>
            </div>
          )}
          {decisionState.persistenceStartTime && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Persistence Timer:</span>
              <span className="text-blue-400">{Math.ceil((currentTime - decisionState.persistenceStartTime) / 1000)}s / {config.PERSISTENCE_SECONDS}s</span>
            </div>
          )}
          {decisionState.postCheckStartTime && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Post-Check Timer:</span>
              <span className="text-green-400">{Math.ceil((currentTime - decisionState.postCheckStartTime) / 1000)}s / {config.POST_CHECK_SECONDS}s</span>
            </div>
          )}
          {decisionState.metricsAtIntervention && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-600">
              <span className="text-slate-400 text-xs">Awaiting improvement on previous metrics vs current.</span>
            </div>
          )}
        </div>
      </section>

      {/* Current Metrics */}
      <section className="bg-slate-700/30 rounded-lg p-3">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
          Current Metrics
        </h3>
        {currentMetrics ? (
          <div className="space-y-2">
            <MetricRow
              label="Participation Imbalance"
              value={formatPercent(currentMetrics.participationImbalance)}
              threshold={formatPercent(config.THRESHOLD_IMBALANCE)}
              isBreached={thresholds?.imbalance}
            />
            <MetricRow
              label="Semantic Repetition"
              value={formatPercent(currentMetrics.semanticRepetitionRate)}
              threshold={formatPercent(config.THRESHOLD_REPETITION)}
              isBreached={thresholds?.repetition}
            />
            <MetricRow
              label="Stagnation Duration"
              value={formatSeconds(currentMetrics.stagnationDuration)}
              threshold={formatSeconds(config.THRESHOLD_STAGNATION_SECONDS)}
              isBreached={thresholds?.stagnation}
            />
            <MetricRow
              label="Diversity (TTR)"
              value={formatPercent(currentMetrics.diversityDevelopment)}
              threshold="—"
              isBreached={false}
            />
          </div>
        ) : (
          <p className="text-slate-500 text-center py-2">No metrics yet</p>
        )}
      </section>

      {/* Speaking Time Distribution */}
      {currentMetrics && Object.keys(currentMetrics.speakingTimeDistribution).length > 0 && (
        <section className="bg-slate-700/30 rounded-lg p-3">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Speaking Distribution
          </h3>
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
        </section>
      )}

      {/* Metrics History */}
      {metricsHistory.length > 0 && (
        <section className="bg-slate-700/30 rounded-lg p-3">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            History (Last {Math.min(metricsHistory.length, 10)})
          </h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {metricsHistory.slice(-10).reverse().map((snapshot) => (
              <div
                key={snapshot.id}
                className="flex items-center justify-between text-xs py-1 border-b border-slate-600/50 last:border-0"
              >
                <span className="text-slate-500">{formatTime(snapshot.timestamp)}</span>
                <div className="flex gap-2">
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
        </section>
      )}

      {/* Config (collapsible) */}
      {showConfig && (
        <section className="bg-slate-700/30 rounded-lg p-3">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Active Configuration
          </h3>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {Object.entries(config).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-slate-500 truncate mr-2">{key}:</span>
                <span className="text-slate-300">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Helper Component ---

interface MetricRowProps {
  label: string;
  value: string;
  threshold: string;
  isBreached?: boolean;
}

function MetricRow({ label, value, threshold, isBreached }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400 text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`font-mono ${isBreached ? 'text-red-400' : 'text-white'}`}>
          {value}
        </span>
        <span className="text-slate-600 text-xs">/ {threshold}</span>
        {isBreached && (
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>
    </div>
  );
}



