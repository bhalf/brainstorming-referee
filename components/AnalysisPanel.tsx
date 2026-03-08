'use client';

import { MetricSnapshot, ExperimentConfig, DecisionEngineState } from '@/lib/types';
import { CONVERSATION_STATE_CONFIG, ENGINE_PHASE_CONFIG } from '@/lib/decision/stateConfig';
import { generateSessionSummaryText } from '@/lib/state/generateSessionSummaryText';
import MetricBar from './shared/MetricBar';
import Panel from './shared/Panel';
import SectionHeader from './shared/SectionHeader';

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

  // v2 state inference
  const inferredState = currentMetrics?.inferredState;
  const convStateConfig = inferredState ? CONVERSATION_STATE_CONFIG[inferredState.state] : null;
  const sessionSummary = generateSessionSummaryText(currentMetrics);
  const phase = decisionState.phase;
  const phaseConfig = ENGINE_PHASE_CONFIG[phase];

  // --- Metric values ---
  const diversity = Math.min(1, currentMetrics.diversityDevelopment);

  // Stagnation display — use a fixed 120s scale for the bar
  const stagnationScale = 120;
  const stagnationNorm = Math.min(1, currentMetrics.stagnationDuration / stagnationScale);

  const isInCooldown = decisionState.cooldownUntil !== null && decisionState.cooldownUntil > Date.now();
  const cooldownSecsLeft = isInCooldown
    ? Math.ceil((decisionState.cooldownUntil! - Date.now()) / 1000)
    : 0;
  const maxInterventions = config.MAX_INTERVENTIONS_PER_10MIN;

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">

      {/* Conversation State + Engine Status */}
      <Panel>
        <SectionHeader icon="🧠" size="page">Session Status</SectionHeader>

        {/* Inferred Conversation State */}
        {inferredState && convStateConfig && (
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border mb-2 ${convStateConfig.severity === 'healthy' ? 'border-green-700/50 bg-green-900/20' :
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
        )}

        {/* --- DYNAMIC SUMMARY --- */}
        <div className="px-3 py-2.5 rounded-lg border border-slate-700/50 bg-slate-800/30 mb-3">
          <div className="text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
            <span className="opacity-70">📝</span> Live Summary
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            {sessionSummary}
          </div>
        </div>

        {/* Engine Phase + Stats */}
        <div className="flex items-center gap-2 mb-2">
          {phaseConfig && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${phaseConfig.badgeColor}`}>
              {phaseConfig.label}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-800/50 rounded p-2 border border-slate-700">
            <div className="text-slate-400 mb-0.5">Interventions</div>
            <div className={`font-semibold text-base ${decisionState.interventionCount >= maxInterventions ? 'text-red-400' : 'text-slate-200'}`}>
              {decisionState.interventionCount} / {maxInterventions}
            </div>
          </div>
          <div className="bg-slate-800/50 rounded p-2 border border-slate-700">
            <div className="text-slate-400 mb-0.5">Cooldown</div>
            <div className={`font-semibold text-base ${isInCooldown ? 'text-yellow-400' : 'text-green-400'}`}>
              {isInCooldown ? `${cooldownSecsLeft}s` : 'Ready'}
            </div>
          </div>
        </div>

        {decisionState.lastInterventionTime && (
          <div className="mt-2 text-xs text-slate-500">
            Last: {Math.round((Date.now() - decisionState.lastInterventionTime) / 1000)}s ago
          </div>
        )}
      </Panel>

      {/* Participation Group */}
      <Panel>
        <SectionHeader icon="👥" size="page">Participation</SectionHeader>

        {/* Speaking Share Bars */}
        <div className="space-y-2 mb-4">
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
                      {percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
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

        {/* Participation Metrics */}
        <div className="space-y-3">
          {currentMetrics.participation && (
            <MetricBar
              label="Risk Score"
              icon="⚠️"
              helpKey="metric.participationRisk"
              value={currentMetrics.participation.participationRiskScore}
              displayValue={`${(currentMetrics.participation.participationRiskScore * 100).toFixed(0)}%`}
              threshold={config.THRESHOLD_PARTICIPATION_RISK}
              higherIsBetter={false}
              statusText={
                speakerCount <= 1
                  ? 'Only 1 speaker'
                  : currentMetrics.participation.participationRiskScore >= config.THRESHOLD_PARTICIPATION_RISK
                    ? 'High imbalance risk'
                    : 'Balanced'
              }
            />
          )}
          <MetricBar
            label="Balance"
            icon="⚖️"
            helpKey="metric.balance"
            value={1 - currentMetrics.participationImbalance}
            displayValue={`${((1 - currentMetrics.participationImbalance) * 100).toFixed(0)}%`}
            threshold={0.5}
            higherIsBetter={true}
            statusText={
              speakerCount <= 1
                ? 'Only 1 speaker'
                : currentMetrics.participationImbalance > 0.5
                  ? 'Imbalanced'
                  : 'Balanced'
            }
          />
        </div>
      </Panel>

      {/* Ideas & Content Group */}
      <Panel>
        <SectionHeader icon="💡" size="page">Ideas & Content</SectionHeader>

        <div className="space-y-3">
          {currentMetrics.semanticDynamics && (
            <>
              <MetricBar
                label="Novelty"
                icon="✨"
                helpKey="metric.novelty"
                value={currentMetrics.semanticDynamics.noveltyRate}
                displayValue={`${(currentMetrics.semanticDynamics.noveltyRate * 100).toFixed(0)}%`}
                threshold={config.THRESHOLD_NOVELTY_RATE}
                higherIsBetter={true}
                statusText={
                  currentMetrics.semanticDynamics.noveltyRate < config.THRESHOLD_NOVELTY_RATE
                    ? 'Ideas are converging'
                    : 'Fresh ideas flowing'
                }
              />
              <MetricBar
                label="Concentration"
                icon="🎯"
                helpKey="metric.concentration"
                value={currentMetrics.semanticDynamics.clusterConcentration}
                displayValue={`${(currentMetrics.semanticDynamics.clusterConcentration * 100).toFixed(0)}%`}
                threshold={config.THRESHOLD_CLUSTER_CONCENTRATION}
                higherIsBetter={false}
                statusText={
                  currentMetrics.semanticDynamics.clusterConcentration >= config.THRESHOLD_CLUSTER_CONCENTRATION
                    ? 'Narrow topic range'
                    : 'Topics well distributed'
                }
              />
            </>
          )}

          <MetricBar
            label="Diversity"
            icon="🌐"
            helpKey="metric.diversity"
            value={diversity}
            displayValue={`${(diversity * 100).toFixed(0)}%`}
            threshold={0.3}
            higherIsBetter={true}
            statusText={
              diversity < 0.3
                ? 'Low vocabulary diversity'
                : 'Good breadth'
            }
          />
        </div>
      </Panel>

      {/* Activity / Flow */}
      <Panel>
        <SectionHeader icon="⏱️" size="page">Activity</SectionHeader>
        <MetricBar
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
          statusText={
            currentMetrics.stagnationDuration >= 60
              ? `No new ideas for ${currentMetrics.stagnationDuration.toFixed(0)}s`
              : 'New content being introduced'
          }
        />
      </Panel>

    </div>
  );
}
