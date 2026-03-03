
'use client';

import { MetricSnapshot, ExperimentConfig } from '@/lib/types';

interface AnalysisPanelProps {
  currentMetrics: MetricSnapshot | null;
  config: ExperimentConfig;
}

export default function AnalysisPanel({
  currentMetrics,
  config,
}: AnalysisPanelProps) {

  if (!currentMetrics) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        <p>No analysis data yet...</p>
      </div>
    );
  }

  const totalSpeakingTime = Object.values(currentMetrics.speakingTimeDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">

      {/* Speaking Share Visualization */}
      <section className="bg-slate-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          🗣️ Speaking Share
        </h3>

        <div className="space-y-3">
           {Object.entries(currentMetrics.speakingTimeDistribution)
             .sort(([, a], [, b]) => b - a) // Sort by speaking time desc
             .map(([speaker, time]) => {
               const percent = totalSpeakingTime > 0 ? (time / totalSpeakingTime) * 100 : 0;
               // Color coding based on dominance? Maybe just simple blue.
               return (
                 <div key={speaker}>
                   <div className="flex justify-between text-xs mb-1">
                     <span className="text-slate-200 font-medium">{speaker}</span>
                     <span className="text-slate-400">{percent.toFixed(1)}%</span>
                   </div>
                   <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                     <div
                       className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                       style={{ width: `${percent}%` }}
                     />
                   </div>
                 </div>
               );
           })}

           {Object.keys(currentMetrics.speakingTimeDistribution).length === 0 && (
             <p className="text-xs text-slate-500 italic">Waiting for speech...</p>
           )}
        </div>
      </section>

      {/* Conversation Health */}
      <section className="bg-slate-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          ❤️ Conversation Health
        </h3>

        <div className="grid grid-cols-2 gap-3">
           <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
              <div className="text-xs text-slate-400 mb-1">Balance</div>
              <div className={`text-lg font-bold ${
                  currentMetrics.participationImbalance > config.THRESHOLD_IMBALANCE ? 'text-red-400' : 'text-green-400'
              }`}>
                 {(100 - (currentMetrics.participationImbalance * 100)).toFixed(0)}%
              </div>
           </div>

           <div className="bg-slate-800/50 p-2 rounded border border-slate-700">
              <div className="text-xs text-slate-400 mb-1">Flow (No Stagnation)</div>
              <div className={`text-lg font-bold ${
                  currentMetrics.stagnationDuration > config.THRESHOLD_STAGNATION_SECONDS ? 'text-red-400' : 'text-green-400'
              }`}>
                 {currentMetrics.stagnationDuration < 5 ? 'Active' : `${currentMetrics.stagnationDuration.toFixed(0)}s quiet`}
              </div>
           </div>
        </div>
      </section>

    </div>
  );
}


