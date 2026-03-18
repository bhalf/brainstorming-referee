'use client';

import type { LiveSummaryState } from '@/lib/hooks/useLiveSummary';

interface LiveSummaryTabProps {
    liveSummary: LiveSummaryState;
}

export default function LiveSummaryTab({ liveSummary }: LiveSummaryTabProps) {
    const { summary, isLoading, lastUpdatedAt } = liveSummary;

    const timeAgo = lastUpdatedAt
        ? `${Math.round((Date.now() - lastUpdatedAt) / 1000)}s ago`
        : null;

    return (
        <div className="h-full flex flex-col p-4 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <h2 className="text-sm font-semibold text-white">Live Summary</h2>
                </div>
                <div className="flex items-center gap-2">
                    {isLoading && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-400">
                            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            Updating...
                        </div>
                    )}
                    {timeAgo && !isLoading && (
                        <span className="text-xs text-slate-500">
                            Updated {timeAgo}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            {summary ? (
                <div className="flex-1 min-h-0">
                    <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
                        <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {summary}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-3xl mb-3 opacity-40">📋</div>
                        <p className="text-sm text-slate-400 mb-1">
                            Waiting for conversation data...
                        </p>
                        <p className="text-xs text-slate-500">
                            A summary will be generated automatically once enough speech has been captured.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
