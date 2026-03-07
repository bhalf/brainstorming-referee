'use client';

import { MetricSnapshot, ExperimentConfig, DecisionEngineState } from '@/lib/types';
import { DECISION_STATE_CONFIG, CONVERSATION_STATE_CONFIG, ENGINE_PHASE_CONFIG } from '@/lib/decision/stateConfig';
import MetricBar from './shared/MetricBar';
import Panel from './shared/Panel';
import SectionHeader from './shared/SectionHeader';
import EmptyState from './shared/EmptyState';

interface AnalysisPanelProps {
  currentMetrics: MetricSnapshot | null;
  config: ExperimentConfig;
  decisionState: DecisionEngineState;
}

export default function AnalysisPanel({
  currentMetrics,
  config,
  decisionState,
}: AnalysisPanelProps) {

  if (!currentMetrics) {
    return (
      <EmptyState
        icon="📊"
        title="No analysis data yet"
        subtitle="Start speaking to begin"
      />
    );
  }

  const totalSpeakingTime = Object.values(currentMetrics.speakingTimeDistribution).reduce((a, b) => a + b, 0);

  // v2 state inference
  const inferredState = currentMetrics?.inferredState;
  const convStateConfig = inferredState ? CONVERSATION_STATE_CONFIG[inferredState.state] : null;
  const phase = decisionState.phase ?? 'MONITORING';
  const phaseConfig = ENGINE_PHASE_CONFIG[phase];

  // --- Metric values ---
  const balance = 1 - currentMetrics.participationImbalance;
  const balanceThreshold = 1 - config.THRESHOLD_IMBALANCE;

  const repetition = currentMetrics.semanticRepetitionRate;
  const repetitionThreshold = config.THRESHOLD_REPETITION;

  const stagnationMax = config.THRESHOLD_STAGNATION_SECONDS * 1.5;
  const stagnationNorm = Math.min(1, currentMetrics.stagnationDuration / stagnationMax);
  const stagnationThresholdNorm = 1 / 1.5;

  const diversity = Math.min(1, currentMetrics.diversityDevelopment);

  // --- Decision Engine ---
  const stateConfig = DECISION_STATE_CONFIG[decisionState.currentState];
  const isInCooldown = decisionState.cooldownUntil !== null && decisionState.cooldownUntil > Date.now();
  const cooldownSecsLeft = isInCooldown
    ? Math.ceil((decisionState.cooldownUntil! - Date.now()) / 1000)
    : 0;
  const maxInterventions = config.MAX_INTERVENTIONS_PER_10MIN;

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">

      {/* Speaking Share */}
      <Panel>
        <SectionHeader icon="🗣️" size="page">Speaking Share</SectionHeader>

        <div className="space-y-3">
          {Object.entries(currentMetrics.speakingTimeDistribution)
            .sort(([, a], [, b]) => b - a)
            .map(([speaker, time]) => {
              const percent = totalSpeakingTime > 0 ? (time / totalSpeakingTime) * 100 : 0;
              const isHighDominance = percent > 60;
              return (
                <div key={speaker}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-200 font-medium truncate max-w-[70%]">{speaker}</span>
                    <span className={isHighDominance ? 'text-orange-400 font-semibold' : 'text-slate-400'}>
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${isHighDominance ? 'bg-orange-500' : 'bg-blue-500'}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          {Object.keys(currentMetrics.speakingTimeDistribution).length === 0 && (
            <p className="text-xs text-slate-500 italic">Waiting for speech…</p>
          )}
        </div>
      </Panel>

      {/* Inferred Conversation State (v2) */}
      {inferredState && convStateConfig && (
        <Panel>
          <SectionHeader icon="🧠" size="page">Conversation State</SectionHeader>
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border mb-2 ${
            convStateConfig.severity === 'healthy' ? 'border-green-700/50 bg-green-900/20' :
            convStateConfig.severity === 'warning' ? 'border-yellow-700/50 bg-yellow-900/20' :
            'border-red-700/50 bg-red-900/20'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${convStateConfig.color}`} />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{convStateConfig.label}</div>
              <div className="text-xs text-slate-400">{convStateConfig.description}</div>
            </div>
            <span className="text-xs text-slate-300 font-mono">{(inferredState.confidence * 100).toFixed(0)}%</span>
          </div>
        </Panel>
      )}

      {/* Conversation Health (v2 metrics + legacy) */}
      <Panel>
        <SectionHeader
          icon="❤️"
          size="page"
          description="Yellow line = intervention threshold. Red = threshold breached."
        >
          Conversation Health
        </SectionHeader>

        <div className="space-y-4">
          {/* v2: Participation Risk */}
          {currentMetrics.participation && (
            <MetricBar
              label="Participation Risk"
              icon="⚠️"
              value={currentMetrics.participation.participationRiskScore}
              displayValue={`${(currentMetrics.participation.participationRiskScore * 100).toFixed(0)}%`}
              threshold={config.THRESHOLD_PARTICIPATION_RISK}
              higherIsBetter={false}
              statusText={
                currentMetrics.participation.participationRiskScore >= config.THRESHOLD_PARTICIPATION_RISK
                  ? 'High participation imbalance risk'
                  : 'Participation is balanced'
              }
            />
          )}

          {/* v2: Novelty Rate */}
          {currentMetrics.semanticDynamics && (
            <MetricBar
              label="Novelty"
              icon="💡"
              value={currentMetrics.semanticDynamics.noveltyRate}
              displayValue={`${(currentMetrics.semanticDynamics.noveltyRate * 100).toFixed(0)}%`}
              threshold={config.THRESHOLD_NOVELTY_RATE}
              higherIsBetter={true}
              statusText={
                currentMetrics.semanticDynamics.noveltyRate < config.THRESHOLD_NOVELTY_RATE
                  ? 'Low novelty — ideas are converging'
                  : 'Good idea novelty'
              }
            />
          )}

          {/* v2: Cluster Concentration */}
          {currentMetrics.semanticDynamics && (
            <MetricBar
              label="Concentration"
              icon="🎯"
              value={currentMetrics.semanticDynamics.clusterConcentration}
              displayValue={`${(currentMetrics.semanticDynamics.clusterConcentration * 100).toFixed(0)}%`}
              threshold={config.THRESHOLD_CLUSTER_CONCENTRATION}
              higherIsBetter={false}
              statusText={
                currentMetrics.semanticDynamics.clusterConcentration >= config.THRESHOLD_CLUSTER_CONCENTRATION
                  ? 'High concentration — narrow topic range'
                  : 'Topics are well distributed'
              }
            />
          )}

          <MetricBar
            label="Balance"
            icon="⚖️"
            value={balance}
            displayValue={`${(balance * 100).toFixed(0)}%`}
            threshold={balanceThreshold}
            higherIsBetter={true}
            statusText={
              balance < balanceThreshold
                ? `Imbalanced — one speaker dominates (>${(config.THRESHOLD_IMBALANCE * 100).toFixed(0)}% threshold)`
                : 'Participation is balanced'
            }
          />

          <MetricBar
            label="Repetition"
            icon="🔁"
            value={repetition}
            displayValue={`${(repetition * 100).toFixed(0)}%`}
            threshold={repetitionThreshold}
            higherIsBetter={false}
            statusText={
              repetition > repetitionThreshold
                ? `High repetition — conversation is going in circles`
                : 'Content is varied'
            }
          />

          <MetricBar
            label="Stagnation"
            icon="⏱️"
            value={stagnationNorm}
            displayValue={
              currentMetrics.stagnationDuration < 5
                ? 'Active'
                : `${currentMetrics.stagnationDuration.toFixed(0)}s`
            }
            threshold={stagnationThresholdNorm}
            higherIsBetter={false}
            statusText={
              currentMetrics.stagnationDuration >= config.THRESHOLD_STAGNATION_SECONDS
                ? `No new ideas for ${currentMetrics.stagnationDuration.toFixed(0)}s (threshold: ${config.THRESHOLD_STAGNATION_SECONDS}s)`
                : 'New content being introduced'
            }
          />

          <MetricBar
            label="Diversity"
            icon="🌐"
            value={diversity}
            displayValue={`${(diversity * 100).toFixed(0)}%`}
            threshold={0.3}
            higherIsBetter={true}
            statusText={
              diversity < 0.3
                ? 'Low vocabulary diversity — narrow topic range'
                : 'Good vocabulary breadth'
            }
          />
        </div>
      </Panel>

      {/* Decision Engine State */}
      <Panel>
        <SectionHeader icon="🤖" size="page">Moderator State</SectionHeader>

        {/* v2 Engine Phase */}
        {phaseConfig && (
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border mb-2 border-slate-700 bg-slate-800/30`}>
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${phaseConfig.badgeColor}`}>
              {phaseConfig.label}
            </span>
            <span className="text-xs text-slate-400">{phaseConfig.description}</span>
          </div>
        )}

        {/* Legacy state */}
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border mb-3 ${stateConfig.panelColor}`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stateConfig.dotColor}`} />
          <div>
            <div className="text-sm font-semibold">{stateConfig.label}</div>
            <div className="text-xs opacity-75">{stateConfig.description}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-800/50 rounded p-2 border border-slate-700">
            <div className="text-slate-400 mb-0.5">Interventions (10 min)</div>
            <div className={`font-semibold text-base ${decisionState.interventionCount >= maxInterventions ? 'text-red-400' : 'text-slate-200'}`}>
              {decisionState.interventionCount} / {maxInterventions}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded p-2 border border-slate-700">
            <div className="text-slate-400 mb-0.5">Cooldown</div>
            <div className={`font-semibold text-base ${isInCooldown ? 'text-yellow-400' : 'text-green-400'}`}>
              {isInCooldown ? `${cooldownSecsLeft}s left` : 'Ready'}
            </div>
          </div>
        </div>

        {decisionState.lastInterventionTime && (
          <div className="mt-2 text-xs text-slate-500">
            Last intervention:{' '}
            {Math.round((Date.now() - decisionState.lastInterventionTime) / 1000)}s ago
            {decisionState.triggerAtIntervention && (
              <span className="ml-1 text-slate-400">
                (trigger: {decisionState.triggerAtIntervention})
              </span>
            )}
          </div>
        )}
      </Panel>

    </div>
  );
}
