'use client';

import { Scenario } from '@/lib/types';
import { SCENARIO_DESCRIPTIONS } from '@/lib/config';

interface ScenarioSelectorProps {
  value: Scenario;
  onChange: (scenario: Scenario) => void;
}

export default function ScenarioSelector({ value, onChange }: ScenarioSelectorProps) {
  return (
    <section className="mb-8">
      <label className="block text-sm font-medium text-slate-300 mb-3">
        Experiment Scenario
      </label>
      <div className="grid gap-3">
        {(Object.keys(SCENARIO_DESCRIPTIONS) as Scenario[]).map((s) => (
          <label
            key={s}
            className={`flex items-center p-4 rounded-lg border cursor-pointer transition-all ${value === s
              ? 'bg-blue-600/20 border-blue-500'
              : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
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
            <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${value === s ? 'border-blue-500' : 'border-slate-500'
              }`}>
              {value === s && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
            </div>
            <div>
              <span className="font-medium">{s === 'baseline' ? 'Baseline' : `Scenario ${s}`}</span>
              <p className="text-sm text-slate-400 mt-0.5">{SCENARIO_DESCRIPTIONS[s]}</p>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
