'use client';

interface WizardProgressProps {
  currentStep: number;
  steps: { label: string }[];
  onStepClick: (step: number) => void;
}

export default function WizardProgress({ currentStep, steps, onStepClick }: WizardProgressProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        const isFuture = stepNum > currentStep;

        return (
          <div key={i} className="flex items-center">
            {/* Step indicator */}
            <button
              type="button"
              onClick={() => isCompleted && onStepClick(stepNum)}
              disabled={isFuture}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                isCompleted
                  ? 'cursor-pointer hover:bg-white/[0.04]'
                  : isCurrent
                    ? 'cursor-default'
                    : 'cursor-default opacity-40'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                isCompleted
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isCurrent
                    ? 'bg-indigo-500/20 text-indigo-400 ring-2 ring-indigo-500/30'
                    : 'bg-white/[0.05] text-[var(--text-tertiary)]'
              }`}>
                {isCompleted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span className={`text-sm font-medium hidden sm:inline ${
                isCurrent
                  ? 'text-[var(--text-primary)]'
                  : isCompleted
                    ? 'text-[var(--text-secondary)]'
                    : 'text-[var(--text-tertiary)]'
              }`}>
                {step.label}
              </span>
            </button>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className={`w-8 h-px mx-1 transition-all ${
                stepNum < currentStep ? 'bg-emerald-500/30' : 'bg-white/10'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
