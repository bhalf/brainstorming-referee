'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { IAInterview } from '@/types/interview-analysis';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface PipelineControlsProps {
  projectId: string;
  interviews: IAInterview[];
  hasCanonicalQuestions: boolean;
  hasAnswers: boolean;
  onRefresh: () => void;
  guideQuestionCount?: number;
}

type StepStatus = 'idle' | 'running' | 'done' | 'error';

const STEPS_WITH_GUIDE = [
  { key: 'transcribed', labelKey: 'step_transcribed', number: 1 },
  { key: 'match-questions', labelKey: 'step_guide_created', number: 2 },
  { key: 'segment-answers', labelKey: 'step_answers_segmented', number: 3 },
];

const STEPS_WITHOUT_GUIDE = [
  { key: 'transcribed', labelKey: 'step_transcribed', number: 1 },
  { key: 'extract-questions', labelKey: 'step_questions_extracted', number: 2 },
  { key: 'match-questions', labelKey: 'step_questions_matched', number: 3 },
  { key: 'segment-answers', labelKey: 'step_answers_segmented', number: 4 },
];

export default function PipelineControls({
  projectId,
  interviews,
  hasCanonicalQuestions,
  hasAnswers,
  onRefresh,
  guideQuestionCount = 0,
}: PipelineControlsProps) {
  const lang = useIALang();
  const [status, setStatus] = useState<Record<string, StepStatus>>({});
  const [error, setError] = useState('');
  const [runningAll, setRunningAll] = useState(false);
  const [lastMode, setLastMode] = useState<string | null>(null);

  const transcribedCount = interviews.filter(i => i.status === 'transcribed' || i.status === 'analyzed').length;
  const pendingCount = interviews.filter(i => i.status === 'transcribed').length;
  const analyzedCount = interviews.filter(i => i.status === 'analyzed').length;
  const hasGuide = guideQuestionCount > 0;
  const isIncremental = hasCanonicalQuestions && pendingCount > 0;
  const steps = hasGuide ? STEPS_WITH_GUIDE : STEPS_WITHOUT_GUIDE;

  const stepStates = {
    'transcribed': transcribedCount > 0 ? 'done' : 'pending',
    'extract-questions': status['extract-questions'] || (hasCanonicalQuestions ? 'done' : 'pending'),
    'match-questions': status['match-questions'] || (hasCanonicalQuestions ? 'done' : 'pending'),
    'segment-answers': status['segment-answers'] || (hasAnswers ? 'done' : 'pending'),
  } as Record<string, string>;

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentStep, setCurrentStep] = useState('');
  const [progressText, setProgressText] = useState('');

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Poll pipeline status
  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/interview-analysis/projects/${projectId}/run-pipeline`);
        const ps = await res.json();

        if (ps.step) setCurrentStep(ps.step);
        if (ps.progress) setProgressText(ps.progress);

        // Map backend step to frontend status
        if (ps.step) {
          setStatus(prev => {
            const updated = { ...prev };
            const stepOrder = ['extract-questions', 'match-questions', 'segment-answers', 'summarize'];
            const currentIdx = stepOrder.indexOf(ps.step);
            for (let i = 0; i < stepOrder.length; i++) {
              if (i < currentIdx) updated[stepOrder[i]] = 'done';
              else if (i === currentIdx) updated[stepOrder[i]] = 'running';
            }
            return updated;
          });
        }

        if (!ps.running) {
          stopPolling();
          setRunningAll(false);
          if (ps.error) {
            setError(ps.error);
          } else if (ps.step === 'done') {
            setLastMode(ps.mode ?? 'full');
            setStatus({
              'extract-questions': 'done',
              'match-questions': 'done',
              'segment-answers': 'done',
            });
            onRefresh();
          }
        }
      } catch {
        // Polling error, will retry
      }
    }, 2000);
  }, [projectId, onRefresh, stopPolling]);

  // Check if pipeline is already running on mount (e.g., page refresh)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/interview-analysis/projects/${projectId}/run-pipeline`);
        const ps = await res.json();
        if (!cancelled && ps.running) {
          setRunningAll(true);
          if (ps.step) setCurrentStep(ps.step);
          if (ps.progress) setProgressText(ps.progress);
          startPolling();
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; stopPolling(); };
  }, [projectId, startPolling, stopPolling]);

  async function runAll(mode: 'incremental' | 'full' = 'incremental') {
    setRunningAll(true);
    setError('');
    setLastMode(null);
    setCurrentStep('');
    setProgressText('');
    setStatus({
      'extract-questions': 'running',
      'match-questions': 'idle',
      'segment-answers': 'idle',
    });

    try {
      const res = await fetch(`/api/interview-analysis/projects/${projectId}/run-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t('error', lang));
      }

      // Pipeline runs in background — start polling
      startPolling();
    } catch (err) {
      setStatus(s => ({ ...s, 'run-pipeline': 'error' }));
      setError(err instanceof Error ? err.message : t('error', lang));
      setRunningAll(false);
    }
  }

  const isRunning = runningAll || Object.values(status).some(s => s === 'running');

  // Determine button label
  let buttonLabel = t('pipeline_start', lang);
  let buttonDisabled = isRunning || transcribedCount === 0;
  if (isIncremental) {
    buttonLabel = `${pendingCount} ${t('pipeline_new_interviews', lang)}`;
    buttonDisabled = isRunning || pendingCount === 0;
  } else if (hasCanonicalQuestions && pendingCount === 0) {
    buttonLabel = t('pipeline_all_done', lang);
    buttonDisabled = true;
  }

  return (
    <div className="ia-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="ia-section-title">
            {t('pipeline_title', lang)}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="ia-section-subtitle">
              {hasGuide ? t('pipeline_desc_guide', lang) : t('pipeline_desc_no_guide', lang)}
            </p>
            {guideQuestionCount > 0 && (
              <span className="ia-badge ia-badge-positive" style={{ fontSize: '10px' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                </svg>
                {guideQuestionCount} {t('pipeline_guide_questions', lang)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Full rebuild button (only when canonicals already exist) */}
          {hasCanonicalQuestions && !isRunning && (
            <button
              className="ia-btn ia-btn-ghost ia-btn-sm"
              onClick={() => runAll('full')}
              title={t('pipeline_full_rebuild_title', lang)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6" /><path d="M2.5 22v-6h6" />
                <path d="M2.5 11.5a10 10 0 0 1 18.3-4.4" /><path d="M21.5 12.5a10 10 0 0 1-18.3 4.4" />
              </svg>
              {t('pipeline_full_rebuild', lang)}
            </button>
          )}

          {/* Main action button */}
          <button
            className="ia-btn ia-btn-primary"
            disabled={buttonDisabled}
            onClick={() => runAll(isIncremental ? 'incremental' : 'full')}
          >
            {runningAll ? (
              <>
                <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                {t('pipeline_running', lang)}{progressText ? ` (${progressText})` : ''}
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {buttonLabel}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <div className="ia-pipeline">
        {steps.map((step, idx) => {
          const state = stepStates[step.key] || 'pending';
          const isDone = state === 'done';
          const isActive = state === 'running';
          const isError = state === 'error';

          const dotClass = isActive ? 'ia-pipeline-dot--active'
            : isError ? 'ia-pipeline-dot--error'
            : isDone ? 'ia-pipeline-dot--done'
            : 'ia-pipeline-dot--pending';

          return (
            <div key={step.key} className="contents">
              {idx > 0 && (
                <div className={`ia-pipeline-connector ${isDone || isActive ? 'ia-pipeline-connector--done' : ''}`} />
              )}
              <div className="ia-pipeline-step">
                <div className={`ia-pipeline-dot ${dotClass}`}>
                  {isActive ? (
                    <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  ) : isDone ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span className={`ia-pipeline-label ${isActive ? 'ia-pipeline-label--active' : ''}`}>
                  {t(step.labelKey, lang)}
                  {step.key === 'transcribed' && transcribedCount > 0 && (
                    <span className="ia-data"> ({analyzedCount > 0 && pendingCount > 0 ? `${analyzedCount}+${pendingCount}` : transcribedCount})</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status messages */}
      {lastMode && !error && (
        <div className="flex items-center gap-2 px-3 py-2 mt-4 rounded-lg" style={{ background: 'var(--ia-success-light)', color: 'var(--ia-success)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-xs font-medium">
            {lastMode === 'incremental'
              ? t('pipeline_incremental_done', lang)
              : t('pipeline_full_done', lang)}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 mt-4 rounded-lg" style={{ background: 'var(--ia-error-light)', color: 'var(--ia-error)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-xs font-medium">{error}</span>
        </div>
      )}
    </div>
  );
}
