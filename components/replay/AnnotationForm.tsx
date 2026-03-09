'use client';

import { useState } from 'react';
import type { InterventionAnnotation, AnnotationRelevance, AnnotationEffectiveness } from '@/lib/types';

const RATING_LABELS = ['', 'Poor', 'Below Avg', 'Average', 'Good', 'Excellent'];

const RELEVANCE_OPTIONS: { value: AnnotationRelevance; label: string }[] = [
    { value: 'relevant', label: 'Relevant' },
    { value: 'partially_relevant', label: 'Partial' },
    { value: 'not_relevant', label: 'Not relevant' },
];

const EFFECTIVENESS_OPTIONS: { value: AnnotationEffectiveness; label: string }[] = [
    { value: 'effective', label: 'Effective' },
    { value: 'partially_effective', label: 'Partial' },
    { value: 'not_effective', label: 'Not effective' },
];

export default function AnnotationForm({ interventionId, annotation, onSave, isSaving }: {
    interventionId: string;
    annotation?: InterventionAnnotation;
    onSave: (id: string, updates: Partial<Pick<InterventionAnnotation, 'rating' | 'relevance' | 'effectiveness' | 'notes'>>) => void;
    isSaving: boolean;
}) {
    const [notes, setNotes] = useState(annotation?.notes ?? '');
    const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    const handleNotesChange = (value: string) => {
        setNotes(value);
        if (notesTimer) clearTimeout(notesTimer);
        setNotesTimer(setTimeout(() => {
            onSave(interventionId, { notes: value });
        }, 800));
    };

    return (
        <div
            className="bg-slate-800/60 rounded-md p-3 border border-slate-600/50 space-y-2"
            onClick={e => e.stopPropagation()}
        >
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Annotation {isSaving && <span className="text-blue-400 ml-1">Saving...</span>}
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-16 shrink-0">Rating:</span>
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(r => (
                        <button
                            key={r}
                            onClick={() => onSave(interventionId, { rating: r })}
                            title={RATING_LABELS[r]}
                            className={`w-6 h-6 rounded text-xs font-medium transition-colors ${annotation?.rating === r
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
                {annotation?.rating && (
                    <span className="text-xs text-slate-500">{RATING_LABELS[annotation.rating]}</span>
                )}
            </div>

            {/* Relevance */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-16 shrink-0">Relevance:</span>
                <div className="flex gap-1">
                    {RELEVANCE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => onSave(interventionId, { relevance: opt.value })}
                            className={`px-2 py-1 rounded text-xs transition-colors ${annotation?.relevance === opt.value
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Effectiveness */}
            <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-16 shrink-0">Effect:</span>
                <div className="flex gap-1">
                    {EFFECTIVENESS_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => onSave(interventionId, { effectiveness: opt.value })}
                            className={`px-2 py-1 rounded text-xs transition-colors ${annotation?.effectiveness === opt.value
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Notes */}
            <div>
                <textarea
                    value={notes}
                    onChange={e => handleNotesChange(e.target.value)}
                    placeholder="Notes (optional)..."
                    rows={2}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
            </div>
        </div>
    );
}
