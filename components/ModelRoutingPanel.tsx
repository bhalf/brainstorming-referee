'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    MODEL_TASK_KEYS,
    TASK_LABELS,
    TASK_DESCRIPTIONS,
    getModelsForTask,
    TASK_CONFIG_CONSTRAINTS,
    DEFAULT_MODEL_ROUTING,
    type ModelRoutingConfig,
    type ModelTaskKey,
    type TaskModelConfig,
    type ModelOption,
} from '@/lib/config/modelRouting';
import type { ModelRoutingLogEntry } from '@/lib/types';

interface ModelRoutingPanelProps {
    logEntries: ModelRoutingLogEntry[];
}

export default function ModelRoutingPanel({ logEntries }: ModelRoutingPanelProps) {
    const [config, setConfig] = useState<ModelRoutingConfig>(DEFAULT_MODEL_ROUTING);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedTask, setExpandedTask] = useState<ModelTaskKey | null>(null);
    const [showLog, setShowLog] = useState(false);

    // Load config on mount
    useEffect(() => {
        fetch('/api/model-routing')
            .then((r) => r.json())
            .then((data) => {
                if (data.config) setConfig(data.config);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // Save config
    const saveConfig = useCallback(async (newConfig: ModelRoutingConfig) => {
        setSaving(true);
        try {
            const res = await fetch('/api/model-routing', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: newConfig }),
            });
            if (res.ok) {
                const data = await res.json();
                setConfig(data.config);
            }
        } catch (e) {
            console.error('Failed to save model routing:', e);
        } finally {
            setSaving(false);
        }
    }, []);

    // Update a single task config field
    const updateTask = useCallback(
        (task: ModelTaskKey, updates: Partial<TaskModelConfig>) => {
            const newConfig = {
                ...config,
                [task]: { ...config[task], ...updates },
            };
            setConfig(newConfig);
            saveConfig(newConfig);
        },
        [config, saveConfig]
    );

    // Reset all to defaults
    const resetToDefaults = useCallback(() => {
        setConfig(DEFAULT_MODEL_ROUTING);
        saveConfig(DEFAULT_MODEL_ROUTING);
    }, [saveConfig]);

    if (loading) {
        return (
            <div className="p-4 text-slate-400 text-sm animate-pulse">
                Loading model config...
            </div>
        );
    }

    // Recent log summary
    const recentLogs = logEntries.slice(-10).reverse();
    const totalCalls = logEntries.length;
    const failedCalls = logEntries.filter((e) => !e.success).length;
    const fallbackCalls = logEntries.filter((e) => e.fallbackUsed).length;
    const avgLatency = totalCalls > 0
        ? Math.round(logEntries.reduce((sum, e) => sum + e.latencyMs, 0) / totalCalls)
        : 0;

    return (
        <div className="h-full overflow-y-auto space-y-3 pr-1">
            {/* Stats Bar */}
            {totalCalls > 0 && (
                <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-slate-300">
                        {totalCalls} calls
                    </span>
                    <span className={`px-2 py-1 rounded ${failedCalls > 0 ? 'bg-red-900/30 text-red-400' : 'bg-slate-700/50 text-slate-300'}`}>
                        {failedCalls} failed
                    </span>
                    <span className={`px-2 py-1 rounded ${fallbackCalls > 0 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-slate-700/50 text-slate-300'}`}>
                        {fallbackCalls} fallbacks
                    </span>
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-slate-300">
                        ~{avgLatency}ms avg
                    </span>
                </div>
            )}

            {/* Task Cards */}
            {MODEL_TASK_KEYS.map((task) => {
                const tc = config[task];
                const isExpanded = expandedTask === task;
                const models = getModelsForTask(task);
                const isChatTask = task === 'moderator_intervention' || task === 'ally_intervention';

                return (
                    <div
                        key={task}
                        className={`rounded-lg border transition-colors ${tc.enabled
                            ? 'bg-slate-700/30 border-slate-600'
                            : 'bg-slate-800/30 border-slate-700 opacity-60'
                            }`}
                    >
                        {/* Header */}
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setExpandedTask(isExpanded ? null : task)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedTask(isExpanded ? null : task); }}
                            className="w-full flex items-center justify-between p-3 text-left cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <TaskIcon task={task} />
                                <div>
                                    <div className="text-sm font-medium text-white">
                                        {TASK_LABELS[task]}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {tc.model} · {tc.timeoutMs / 1000}s timeout
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Enable toggle */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateTask(task, { enabled: !tc.enabled });
                                    }}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${tc.enabled ? 'bg-green-600' : 'bg-slate-600'
                                        }`}
                                >
                                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${tc.enabled ? 'left-4' : 'left-0.5'
                                        }`} />
                                </button>
                                <span className="text-slate-400 text-xs">
                                    {isExpanded ? '▼' : '▶'}
                                </span>
                            </div>
                        </div>

                        {/* Expanded Config */}
                        {isExpanded && (
                            <div className="px-3 pb-3 space-y-3 border-t border-slate-700 pt-3">
                                <p className="text-xs text-slate-500">{TASK_DESCRIPTIONS[task]}</p>

                                {/* Model Select */}
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Model</label>
                                    <select
                                        value={tc.model}
                                        onChange={(e) => updateTask(task, { model: e.target.value })}
                                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        {models.map((m: ModelOption) => (
                                            <option key={m.model} value={m.model}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Temperature (chat tasks only) */}
                                {isChatTask && (
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <label className="text-xs text-slate-400">Temperature</label>
                                            <span className="text-xs text-slate-500">{tc.temperature.toFixed(1)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={TASK_CONFIG_CONSTRAINTS.temperature.min}
                                            max={TASK_CONFIG_CONSTRAINTS.temperature.max}
                                            step="0.1"
                                            value={tc.temperature}
                                            onChange={(e) => updateTask(task, { temperature: parseFloat(e.target.value) })}
                                            className="w-full h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                    </div>
                                )}

                                {/* Max Tokens (chat tasks only) */}
                                {isChatTask && (
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Max Tokens</label>
                                        <input
                                            type="number"
                                            min={TASK_CONFIG_CONSTRAINTS.maxTokens.min}
                                            max={TASK_CONFIG_CONSTRAINTS.maxTokens.max}
                                            value={tc.maxTokens}
                                            onChange={(e) => updateTask(task, { maxTokens: parseInt(e.target.value) || 0 })}
                                            className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                )}

                                {/* Timeout */}
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">
                                        Timeout (ms)
                                    </label>
                                    <input
                                        type="number"
                                        min={TASK_CONFIG_CONSTRAINTS.timeoutMs.min}
                                        max={TASK_CONFIG_CONSTRAINTS.timeoutMs.max}
                                        step="1000"
                                        value={tc.timeoutMs}
                                        onChange={(e) => updateTask(task, { timeoutMs: parseInt(e.target.value) || 5000 })}
                                        className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Fallback Model */}
                                {isChatTask && (
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Fallback Model</label>
                                        <select
                                            value={tc.fallbacks[0]?.model || ''}
                                            onChange={(e) => {
                                                const model = e.target.value;
                                                updateTask(task, {
                                                    fallbacks: model
                                                        ? [{ provider: 'openai' as const, model }]
                                                        : [],
                                                });
                                            }}
                                            className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                            <option value="">No fallback</option>
                                            {models
                                                .filter((m: ModelOption) => m.model !== tc.model)
                                                .map((m: ModelOption) => (
                                                    <option key={m.model} value={m.model}>
                                                        {m.label}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Reset Button */}
            <button
                onClick={resetToDefaults}
                disabled={saving}
                className="w-full py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded hover:border-slate-600 transition-colors"
            >
                Reset to Defaults
            </button>

            {/* Log Toggle */}
            {totalCalls > 0 && (
                <div>
                    <button
                        onClick={() => setShowLog(!showLog)}
                        className="text-xs text-slate-400 hover:text-slate-200"
                    >
                        {showLog ? '▼ Hide Log' : '▶ Show Call Log'} ({totalCalls})
                    </button>

                    {showLog && (
                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                            {recentLogs.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`text-xs p-2 rounded ${entry.success
                                        ? 'bg-slate-700/30 text-slate-300'
                                        : 'bg-red-900/20 text-red-400'
                                        }`}
                                >
                                    <div className="flex justify-between">
                                        <span className="font-medium">{TASK_LABELS[entry.task as ModelTaskKey] || entry.task}</span>
                                        <span>{entry.latencyMs}ms</span>
                                    </div>
                                    <div className="text-slate-500">
                                        {entry.model}
                                        {entry.fallbackUsed && (
                                            <span className="text-yellow-500 ml-1">⚡ fallback</span>
                                        )}
                                        {entry.error && (
                                            <span className="text-red-400 ml-1">✗ {entry.error}</span>
                                        )}
                                        {entry.outputTokens && (
                                            <span className="ml-1">· {entry.outputTokens} tok</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// --- Task Icon Helper ---

function TaskIcon({ task }: { task: ModelTaskKey }) {
    const icons: Record<ModelTaskKey, string> = {
        moderator_intervention: '🎯',
        ally_intervention: '💡',
        embeddings_similarity: '🔗',
        transcription_server: '🎙️',
    };

    return <span className="text-sm">{icons[task]}</span>;
}
