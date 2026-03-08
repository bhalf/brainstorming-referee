'use client';

import { Scenario } from '@/lib/types';
import { SCENARIO_DESCRIPTIONS } from '@/lib/config';

interface ScenarioSelectorProps {
  value: Scenario;
  onChange: (scenario: Scenario) => void;
}

export default function ScenarioSelector({ value, onChange }: ScenarioSelectorProps) {
  return (
    <section className="mb-5">
      <label className="block text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">
        Experiment Scenario
      </label>
      <div className="grid gap-2">
        {(Object.keys(SCENARIO_DESCRIPTIONS) as Scenario[]).map((s) => (
          <label
            key={s}
            className={`flex items-center px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${value === s
              ? 'bg-blue-600/10 border-blue-500/50'
              : 'bg-slate-900/40 border-slate-700/60 hover:border-slate-600'
              }`}
          >
            <input
              type="radio"
              name="scenario"
              value={s}
              checked={value === s}
              onChange={(e) => onChange(e.target.value as Scenario)}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center flex-shrink-0 ${value === s ? 'border-blue-500' : 'border-slate-600'
              }`}>
              {value === s && <div className="w-2 h-2 rounded-full bg-blue-500" />}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-medium text-white">{s === 'baseline' ? 'Baseline' : `Scenario ${s}`}</span>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{SCENARIO_DESCRIPTIONS[s]}</p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
