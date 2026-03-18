'use client';

import type { InterventionAnnotation } from '@/lib/types';
import type { TimelineEvent } from './replayHelpers';
import { formatRelativeTime, getSpeakerColor, RECOVERY_BADGE, STATE_COLORS, formatPercent } from './replayHelpers';
import AnnotationForm from './AnnotationForm';

export default function TimelineEventRow({ event, startTime, speakers, expanded, onToggle, annotation, onSaveAnnotation, isSaving }: {
    event: TimelineEvent;
    startTime: number;
    speakers: string[];
    expanded: boolean;
    onToggle?: () => void;
    annotation?: InterventionAnnotation;
    onSaveAnnotation?: (interventionId: string, updates: Partial<Pick<InterventionAnnotation, 'rating' | 'relevance' | 'effectiveness' | 'notes'>>) => void;
    isSaving?: boolean;
}) {
    const relTime = formatRelativeTime(event.timestamp, startTime);

    if (event.type === 'segment' && event.segment) {
        const seg = event.segment;
        return (
            <div className="flex gap-3 py-1 px-2 hover:bg-slate-800/30 rounded group">
                <span className="text-xs text-slate-600 font-mono w-12 shrink-0 pt-0.5">{relTime}</span>
                <span className="text-xs text-slate-600 w-0.5 shrink-0 bg-blue-500/30 rounded" />
                <div className="min-w-0">
                    <span className={`text-xs font-medium ${getSpeakerColor(seg.speaker, speakers)}`}>
                        {seg.speaker}
                    </span>
                    <span className="text-sm text-slate-300 ml-2">{seg.text}</span>
                </div>
            </div>
        );
    }

    if (event.type === 'intervention' && event.intervention) {
        const int = event.intervention;
        const recoveryInfo = int.recoveryResult ? RECOVERY_BADGE[int.recoveryResult] : null;
        const hasAnnotation = annotation && (annotation.rating || annotation.relevance || annotation.effectiveness);
        return (
            <div className="my-2">
                <button
                    onClick={onToggle}
                    className="w-full flex gap-3 py-2 px-3 bg-purple-500/10 border border-purple-500/30 rounded-lg hover:bg-purple-500/15 transition-colors text-left"
                >
                    <span className="text-xs text-slate-500 font-mono w-12 shrink-0 pt-0.5">{relTime}</span>
                    <span className="text-xs text-slate-600 w-0.5 shrink-0 bg-purple-500/50 rounded" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-purple-300 uppercase">
                                {int.type}
                            </span>
                            {int.intent && (
                                <span className="text-xs text-purple-400/70">
                                    {int.intent.replace(/_/g, ' ')}
                                </span>
                            )}
                            {recoveryInfo && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${recoveryInfo.color}`}>
                                    {recoveryInfo.text}
                                </span>
                            )}
                            {hasAnnotation && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                                    Annotated
                                </span>
                            )}
                            {int.modelUsed && (
                                <span className="text-xs text-slate-600">{int.modelUsed}</span>
                            )}
                        </div>
                        <p className="text-sm text-slate-200">{int.text}</p>
                        {expanded && (
                            <div className="mt-2 space-y-3">
                                {/* Technical details */}
                                <div className="text-xs text-slate-500 space-y-1">
                                    <div>Trigger: {int.trigger} | Spoken: {int.spoken ? 'Yes' : 'No'}</div>
                                    {int.latencyMs !== undefined && <div>Latency: {int.latencyMs}ms</div>}
                                    {int.triggeringState && <div>Triggering state: {int.triggeringState} ({formatPercent(int.stateConfidence ?? 0)})</div>}
                                    {int.recoveryCheckedAt && <div>Recovery checked: {formatRelativeTime(int.recoveryCheckedAt, startTime)}</div>}
                                </div>

                                {/* Annotation Form */}
                                {onSaveAnnotation && (
                                    <AnnotationForm
                                        interventionId={int.id}
                                        annotation={annotation}
                                        onSave={onSaveAnnotation}
                                        isSaving={isSaving ?? false}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </button>
            </div>
        );
    }

    if (event.type === 'state_change' && event.stateChange) {
        const sc = event.stateChange;
        return (
            <div className="flex gap-3 py-1.5 px-2">
                <span className="text-xs text-slate-600 font-mono w-12 shrink-0 pt-0.5">{relTime}</span>
                <span className="text-xs text-slate-600 w-0.5 shrink-0 bg-emerald-500/30 rounded" />
                <div className={`text-xs font-medium ${STATE_COLORS[sc.state]}`}>
                    {sc.state.replace(/_/g, ' ')}
                    <span className="opacity-60 ml-1">({formatPercent(sc.confidence)})</span>
                </div>
            </div>
        );
    }

    return null;
}
