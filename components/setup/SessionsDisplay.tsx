'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/services/apiClient';

interface SessionListItem {
    id: string;
    roomName: string;
    scenario: string;
    language: string;
    startedAt: string;
    endedAt: string | null;
    participantCount: number;
    hostIdentity?: string;
}

function formatDuration(startedAt: string): string {
    const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}

/**
 * Displays active and past sessions in the setup page.
 * Auto-refreshes every 10 seconds.
 */
export function SessionsDisplay() {
    const router = useRouter();
    const [active, setActive] = useState<SessionListItem[]>([]);
    const [past, setPast] = useState<SessionListItem[]>([]);
    const [loaded, setLoaded] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await apiGet<{ active?: SessionListItem[]; past?: SessionListItem[] }>('/api/sessions', { limit: '20' });
            setActive(data.active || []);
            setPast(data.past || []);
        } catch { /* ignore */ }
        setLoaded(true);
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 10_000);
        return () => clearInterval(interval);
    }, [load]);

    if (!loaded) return null;

    return (
        <>
            {/* Active Rooms */}
            {active.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active Rooms
                    </h2>
                    <div className="space-y-2">
                        {active.map(s => (
                            <div
                                key={s.id}
                                className="bg-slate-800/60 border border-emerald-900/30 rounded-xl p-4 flex items-center justify-between gap-3 hover:border-emerald-700/50 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-white font-medium text-sm truncate">{s.roomName}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 shrink-0">
                                            Live
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                        <span>Scenario {s.scenario}</span>
                                        <span>{s.language}</span>
                                        <span>{formatDuration(s.startedAt)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex items-center gap-1 text-sm text-slate-300 bg-slate-700/50 px-2.5 py-1 rounded-lg">
                                        <span>👥</span>
                                        <span className="font-medium">{s.participantCount}</span>
                                    </div>
                                    <button
                                        onClick={() => router.push(`/call/${encodeURIComponent(s.roomName)}?role=participant&name=Observer`)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-medium text-white transition-colors"
                                    >
                                        Join
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Past Sessions */}
            {past.length > 0 && (
                <div className="mt-8">
                    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Past Sessions</h2>

                    {/* Mobile: Card list */}
                    <div className="sm:hidden space-y-2">
                        {past.map(s => (
                            <div key={s.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-medium text-sm truncate">{s.roomName}</div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                        <span>Scenario {s.scenario}</span>
                                        <span>·</span>
                                        <span>{new Date(s.startedAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <Link
                                    href={`/replay/${s.id}`}
                                    className="shrink-0 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium text-blue-400 transition-colors min-h-[36px] flex items-center"
                                >
                                    Replay
                                </Link>
                            </div>
                        ))}
                    </div>

                    {/* Desktop: Table */}
                    <div className="hidden sm:block bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-slate-700/60 text-slate-500 text-left">
                                    <th className="px-4 py-2.5 font-medium">Room</th>
                                    <th className="px-4 py-2.5 font-medium">Scenario</th>
                                    <th className="px-4 py-2.5 font-medium">Started</th>
                                    <th className="px-4 py-2.5 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {past.map(s => (
                                    <tr key={s.id} className="border-b border-slate-700/30 last:border-b-0 hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-2.5 text-white font-medium">{s.roomName}</td>
                                        <td className="px-4 py-2.5 text-slate-400">{s.scenario}</td>
                                        <td className="px-4 py-2.5 text-slate-500">
                                            {new Date(s.startedAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <Link
                                                href={`/replay/${s.id}`}
                                                className="text-blue-400 hover:text-blue-300 text-[10px] font-medium"
                                            >
                                                Replay
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}
