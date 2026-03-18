'use client';

import { useState, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { MetricSnapshot, ExperimentConfig, DecisionEngineState, Intervention, GoalTrackingState } from '@/lib/types';
import { CONVERSATION_STATE_CONFIG, ENGINE_PHASE_CONFIG } from '@/lib/decision/stateConfig';
import { generateSessionSummaryText } from '@/lib/state/generateSessionSummaryText';

import type { LiveSummaryState } from '@/lib/hooks/useLiveSummary';
import InfoPopover from './shared/InfoPopover';
import Panel from './shared/Panel';
import GoalsPanel from './GoalsPanel';

interface DashboardTabProps {
  currentMetrics: MetricSnapshot | null;
  metricsHistory: MetricSnapshot[];
  config: ExperimentConfig;
  decisionState: DecisionEngineState;
  interventions: Intervention[];
  liveSummary: LiveSummaryState;
  restrictedView?: boolean;
  goalTracking?: GoalTrackingState | null;
}

// ─── Mini Sparkline ──────────────────────────────────────────────────────────

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <div className="w-12 h-5 flex-shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color.replace('#', '')})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Dashboard Metric Bar ────────────────────────────────────────────────────

interface DashboardMetricBarProps {
  label: string;
  icon: string;
  value: number;
  displayValue: string;
  threshold: number;
  higherIsBetter: boolean;
  statusText: string;
  sparkData?: number[];
  sparkColor?: string;
  helpKey?: string;
}

function DashboardMetricBar({
  label,
  icon,
  value,
  displayValue,
  threshold,
  higherIsBetter,
  statusText,
  sparkData,
  sparkColor,
  helpKey,
}: DashboardMetricBarProps) {
  const breached = higherIsBetter ? value < threshold : value > threshold;
  const barColor = breached ? 'bg-red-500' : value === 0 ? 'bg-slate-600' : 'bg-emerald-500';
  const statusColor = breached ? 'text-red-400' : 'text-emerald-400';
  const valueColor = breached ? 'text-red-400' : 'text-slate-100';
  const barWidth = Math.min(100, Math.max(0, value * 100));
  const thresholdPos = Math.min(100, Math.max(0, threshold * 100));

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-300 font-medium flex items-center gap-1">
          <span>{icon}</span>
          <span>{label}</span>
          {helpKey && <span className="inline-flex align-middle"><InfoPopover helpKey={helpKey} size="xs" /></span>}
        </span>
        <div className="flex items-center gap-2">
          {sparkData && sparkColor && <MiniSparkline data={sparkData} color={sparkColor} />}
          <span className={`font-mono font-semibold ${valueColor}`}>{displayValue}</span>
        </div>
      </div>

      <div className="relative h-2 bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/70"
          style={{ left: `${thresholdPos}%` }}
          title={`Threshold: ${(threshold * 100).toFixed(0)}%`}
        />
      </div>

      <div className={`text-[10px] mt-0.5 ${statusColor}`}>{statusText}</div>
    </div>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────────────────────

export default function DashboardTab({
  currentMetrics,
  metricsHistory,
  config,
  decisionState,
  interventions,
  liveSummary,
  restrictedView,
  goalTracking,
}: DashboardTabProps) {

  const [showMoreParticipation, setShowMoreParticipation] = useState(false);
  const [showMoreIdeas, setShowMoreIdeas] = useState(false);

  // Extract sparkline data (last 30 snapshots) for each metric
  const sparklines = useMemo(() => {
    const recent = metricsHistory.slice(-30);
    return {
      participationRisk: recent.map(m => m.participation?.participationRiskScore ?? m.participationImbalance),
      balance: recent.map(m => 1 - m.participationImbalance),
      novelty: recent.map(m => m.semanticDynamics?.noveltyRate ?? 0),
      spread: recent.map(m => m.semanticDynamics ? 1 - m.semanticDynamics.clusterConcentration : 0),
      ideaRate: recent.map(m => m.semanticDynamics ? Math.min(1, m.semanticDynamics.ideationalFluencyRate / 10) : 0),
      stagnation: recent.map(m => Math.min(1, m.stagnationDuration / 120)),
    };
  }, [metricsHistory]);

  if (!currentMetrics) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-slate-300 font-medium mb-1">Computing metrics...</div>
          <div className="text-xs text-slate-500">Waiting for speech data</div>
        </div>
      </div>
    );
  }

  const totalSpeakingTime = Object.values(currentMetrics.speakingTimeDistribution).reduce((a, b) => a + b, 0);
  const speakerCount = Object.keys(currentMetrics.speakingTimeDistribution).length;

  // Map inferred conversation state to its display config (label, color, severity)
  const inferredState = currentMetrics?.inferredState;
  const convStateConfig = inferredState ? CONVERSATION_STATE_CONFIG[inferredState.state] : null;
  const phase = decisionState.phase;
  const phaseConfig = ENGINE_PHASE_CONFIG[phase];

  // Normalize metric values to 0-1 range
  const diversity = Math.min(1, currentMetrics.diversityDevelopment);
  const stagnationNorm = Math.min(1, currentMetrics.stagnationDuration / 120);
  const isInCooldown = decisionState.cooldownUntil !== null && decisionState.cooldownUntil > Date.now();
  const cooldownSecsLeft = isInCooldown ? Math.ceil((decisionState.cooldownUntil! - Date.now()) / 1000) : 0;
  const maxInterventions = config.MAX_INTERVENTIONS_PER_10MIN;

  const topicSpread = currentMetrics.semanticDynamics
    ? 1 - currentMetrics.semanticDynamics.clusterConcentration
    : 0;

  // Prefer AI-generated summary, fall back to deterministic text generation
  const summaryText = liveSummary.summary || generateSessionSummaryText(currentMetrics);

  // Recent interventions (last 3)
  const recentInterventions = interventions.slice(-3).reverse();

  return (
    <div className="h-full overflow-y-auto space-y-3 p-3">

      {/* Session State + Engine Phase (host only) */}
      {!restrictedView && (
        <Panel className="!p-3">
          <div className="flex items-center gap-2 mb-2">
            {inferredState && convStateConfig && (
              <div className={`flex items-center gap-2 flex-1 px-2.5 py-1.5 rounded-lg border ${convStateConfig.severity === 'healthy' ? 'border-green-700/50 bg-green-900/20' :
                convStateConfig.severity === 'warning' ? 'border-yellow-700/50 bg-yellow-900/20' :
                  'border-red-700/50 bg-red-900/20'
                }`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${convStateConfig.color}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white">{convStateConfig.label}</span>
                  <span className="text-xs text-slate-400 ml-1.5">({(inferredState.confidence * 100).toFixed(0)}%)</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            {phaseConfig && (
              <span className={`px-2 py-0.5 rounded font-medium text-white ${phaseConfig.badgeColor}`}>
                {phaseConfig.label}
              </span>
            )}
            <span className="text-slate-400">
              <span className={decisionState.interventionCount >= maxInterventions ? 'text-red-400 font-semibold' : 'text-slate-200'}>
                {decisionState.interventionCount}/{maxInterventions}
              </span>
              {' '}interventions
            </span>
            {isInCooldown && (
              <span className="text-yellow-400 font-mono">{cooldownSecsLeft}s cooldown</span>
            )}
          </div>
        </Panel>
      )}

      {/* Live Summary */}
      <Panel className="!p-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xs font-semibold text-slate-300">Live Summary</span>
          {liveSummary.isLoading && (
            <div className="w-2.5 h-2.5 border border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{summaryText}</p>
      </Panel>

      {/* Goals Progress */}
      {goalTracking && goalTracking.goals.length > 0 && (
        (!restrictedView || config.GOALS_VISIBLE_TO_ALL) && (
          <GoalsPanel goalTracking={goalTracking} />
        )
      )}

      {/* Analytics sections (host only) */}
      {!restrictedView && (<>
      <Panel className="!p-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Participation</h4>

        {/* Speaker Bars */}
        <div className="space-y-1.5 mb-3">
          {Object.entries(currentMetrics.speakingTimeDistribution)
            .sort(([, a], [, b]) => b - a)
            .map(([speaker, time]) => {
              const percent = totalSpeakingTime > 0 ? (time / totalSpeakingTime) * 100 : 0;
              const isHighDominance = percent > 60;
              return (
                <div key={speaker}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-200 font-medium truncate max-w-[70%]">{speaker}</span>
                    <span className={isHighDominance ? 'text-orange-400 font-semibold' : 'text-slate-400'}>
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${isHighDominance ? 'bg-orange-500' : 'bg-blue-500'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          {speakerCount === 0 && (
            <p className="text-xs text-slate-500 italic">Waiting for speech...</p>
          )}
        </div>

        {/* Primary Participation Metrics */}
        <div className="space-y-3">
          {currentMetrics.participation && (
            <DashboardMetricBar
              label="Risk"
              icon="⚠️"
              helpKey="metric.participationRisk"
              value={currentMetrics.participation.participationRiskScore}
              displayValue={`${(currentMetrics.participation.participationRiskScore * 100).toFixed(0)}%`}
              threshold={config.THRESHOLD_PARTICIPATION_RISK}
              higherIsBetter={false}
              sparkData={sparklines.participationRisk}
              sparkColor="#f97316"
              statusText={
                speakerCount <= 1
                  ? 'Only 1 speaker'
                  : currentMetrics.participation.participationRiskScore >= config.THRESHOLD_PARTICIPATION_RISK
                    ? 'High imbalance'
                    : 'Balanced'
              }
            />
          )}
          <DashboardMetricBar
            label="Balance"
            icon="⚖️"
            helpKey="metric.balance"
            value={1 - currentMetrics.participationImbalance}
            displayValue={`${((1 - currentMetrics.participationImbalance) * 100).toFixed(0)}%`}
            threshold={0.5}
            higherIsBetter={true}
            sparkData={sparklines.balance}
            sparkColor="#3b82f6"
            statusText={
              speakerCount <= 1
                ? 'Only 1 speaker'
                : currentMetrics.participationImbalance > 0.5
                  ? 'Imbalanced'
                  : 'Balanced'
            }
          />
        </div>

        {/* Show more: Long-Term Balance */}
        {currentMetrics.participation && (
          <>
            <button
              onClick={() => setShowMoreParticipation(!showMoreParticipation)}
              className="text-xs text-slate-500 hover:text-blue-400 transition-colors mt-2 flex items-center gap-1"
            >
              <span className={`transition-transform ${showMoreParticipation ? 'rotate-90' : ''}`}>▶</span>
              {showMoreParticipation ? 'Show less' : 'Show more'}
            </button>
            {showMoreParticipation && (
              <div className="mt-2">
                <DashboardMetricBar
                  label="Long-Term"
                  icon="📊"
                  helpKey="metric.cumulativeBalance"
                  value={1 - currentMetrics.participation.cumulativeParticipationImbalance}
                  displayValue={`${((1 - currentMetrics.participation.cumulativeParticipationImbalance) * 100).toFixed(0)}%`}
                  threshold={0.5}
                  higherIsBetter={true}
                  statusText={
                    currentMetrics.participation.cumulativeParticipationImbalance > 0.5
                      ? 'Long-term imbalance'
                      : 'Stable over time'
                  }
                />
              </div>
            )}
          </>
        )}
      </Panel>

      {/* Idea Quality */}
      <Panel className="!p-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Idea Quality</h4>

        <div className="space-y-3">
          {currentMetrics.semanticDynamics && (
            <>
              <DashboardMetricBar
                label="Novelty"
                icon="✨"
                helpKey="metric.novelty"
                value={currentMetrics.semanticDynamics.noveltyRate}
                displayValue={`${(currentMetrics.semanticDynamics.noveltyRate * 100).toFixed(0)}%`}
                threshold={config.THRESHOLD_NOVELTY_RATE}
                higherIsBetter={true}
                sparkData={sparklines.novelty}
                sparkColor="#22c55e"
                statusText={
                  currentMetrics.semanticDynamics.noveltyRate < config.THRESHOLD_NOVELTY_RATE
                    ? 'Converging'
                    : 'Fresh ideas'
                }
              />
              <DashboardMetricBar
                label="Spread"
                icon="🎯"
                helpKey="metric.concentration"
                value={topicSpread}
                displayValue={`${(topicSpread * 100).toFixed(0)}%`}
                threshold={1 - config.THRESHOLD_CLUSTER_CONCENTRATION}
                higherIsBetter={true}
                sparkData={sparklines.spread}
                sparkColor="#3b82f6"
                statusText={
                  currentMetrics.semanticDynamics.clusterConcentration >= config.THRESHOLD_CLUSTER_CONCENTRATION
                    ? 'Narrow range'
                    : 'Well distributed'
                }
              />
            </>
          )}
        </div>

        {/* Show more: Idea Building + Vocabulary Breadth */}
        <button
          onClick={() => setShowMoreIdeas(!showMoreIdeas)}
          className="text-xs text-slate-500 hover:text-blue-400 transition-colors mt-2 flex items-center gap-1"
        >
          <span className={`transition-transform ${showMoreIdeas ? 'rotate-90' : ''}`}>▶</span>
          {showMoreIdeas ? 'Show less' : 'Show more'}
        </button>
        {showMoreIdeas && (
          <div className="mt-2 space-y-3">
            {currentMetrics.semanticDynamics && (
              <DashboardMetricBar
                label="Building"
                icon="🔗"
                helpKey="metric.piggybacking"
                value={currentMetrics.semanticDynamics.piggybackingScore}
                displayValue={`${(currentMetrics.semanticDynamics.piggybackingScore * 100).toFixed(0)}%`}
                threshold={0.4}
                higherIsBetter={true}
                statusText={
                  currentMetrics.semanticDynamics.piggybackingScore >= 0.5
                    ? 'Good building'
                    : currentMetrics.semanticDynamics.piggybackingScore >= 0.3
                      ? 'Some connections'
                      : 'Parallel talks'
                }
              />
            )}
            <DashboardMetricBar
              label="Vocabulary"
              icon="🌐"
              helpKey="metric.diversity"
              value={diversity}
              displayValue={`${(diversity * 100).toFixed(0)}%`}
              threshold={0.3}
              higherIsBetter={true}
              statusText={diversity < 0.3 ? 'Low diversity' : 'Good breadth'}
            />
          </div>
        )}
      </Panel>

      {/* Activity */}
      <Panel className="!p-3">
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Activity</h4>
        <div className="space-y-3">
          {currentMetrics.semanticDynamics && (
            <DashboardMetricBar
              label="Idea Rate"
              icon="💬"
              helpKey="metric.fluency"
              value={Math.min(1, currentMetrics.semanticDynamics.ideationalFluencyRate / 10)}
              displayValue={`${currentMetrics.semanticDynamics.ideationalFluencyRate.toFixed(1)}/m`}
              threshold={0.2}
              higherIsBetter={true}
              sparkData={sparklines.ideaRate}
              sparkColor="#06b6d4"
              statusText={
                currentMetrics.semanticDynamics.ideationalFluencyRate >= 4
                  ? 'Healthy flow'
                  : currentMetrics.semanticDynamics.ideationalFluencyRate >= 2
                    ? 'Moderate'
                    : 'Very low'
              }
            />
          )}
          <DashboardMetricBar
            label="Stagnation"
            icon="⏸️"
            helpKey="metric.stagnation"
            value={stagnationNorm}
            displayValue={
              currentMetrics.stagnationDuration < 5
                ? 'Active'
                : `${currentMetrics.stagnationDuration.toFixed(0)}s`
            }
            threshold={0.5}
            higherIsBetter={false}
            sparkData={sparklines.stagnation}
            sparkColor="#eab308"
            statusText={
              currentMetrics.stagnationDuration >= 60
                ? `Stalled ${currentMetrics.stagnationDuration.toFixed(0)}s`
                : 'New content'
            }
          />
        </div>
      </Panel>
      </>)}

      {/* Recent Interventions */}
      {recentInterventions.length > 0 && (
        <Panel className="!p-3">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Recent Interventions</h4>
          <div className="space-y-2">
            {recentInterventions.map((intervention) => {
              const intentLabels: Record<string, string> = {
                PARTICIPATION_REBALANCING: 'Rebalancing',
                PERSPECTIVE_BROADENING: 'Broadening',
                REACTIVATION: 'Reactivation',
                ALLY_IMPULSE: 'Ally Impulse',
                NORM_REINFORCEMENT: 'Rule Reminder',
                GOAL_REFOCUS: 'Goal Refocus',
              };
              const label = intervention.intent
                ? intentLabels[intervention.intent] || intervention.intent
                : intervention.trigger;
              const isAlly = intervention.type !== 'moderator';
              const borderColor = isAlly ? 'border-purple-500/50' : 'border-blue-500/50';
              const ago = Math.round((Date.now() - intervention.timestamp) / 1000);
              const agoText = ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}min ago`;

              return (
                <div key={intervention.id} className={`rounded-lg p-2.5 border-l-3 ${borderColor} bg-slate-800/30`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-300">
                      {isAlly ? '💡 Ally' : '🤖 Moderator'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">{label}</span>
                      <span className="text-xs text-slate-500">{agoText}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{intervention.text}</p>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
