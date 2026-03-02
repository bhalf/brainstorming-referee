'use client';

import { SessionLog } from '@/lib/types';

interface ExportButtonProps {
  sessionLog: SessionLog;
  roomName: string;
  disabled?: boolean;
}

export default function ExportButton({ sessionLog, roomName, disabled = false }: ExportButtonProps) {
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(sessionLog, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `brainstorming-${roomName}-${timestamp}.json`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    try {
      const dataStr = JSON.stringify(sessionLog, null, 2);
      await navigator.clipboard.writeText(dataStr);
      alert('Session log copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  const stats = {
    transcriptCount: sessionLog.transcriptSegments.length,
    metricsCount: sessionLog.metricSnapshots.length,
    interventionCount: sessionLog.interventions.length,
    errorCount: sessionLog.errors.length,
    duration: sessionLog.metadata.endTime && sessionLog.metadata.startTime
      ? Math.round((sessionLog.metadata.endTime - sessionLog.metadata.startTime) / 1000 / 60)
      : null,
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-700/30 rounded p-2">
          <span className="text-slate-400">Transcript:</span>
          <span className="text-white ml-1">{stats.transcriptCount} segments</span>
        </div>
        <div className="bg-slate-700/30 rounded p-2">
          <span className="text-slate-400">Metrics:</span>
          <span className="text-white ml-1">{stats.metricsCount} snapshots</span>
        </div>
        <div className="bg-slate-700/30 rounded p-2">
          <span className="text-slate-400">Interventions:</span>
          <span className="text-white ml-1">{stats.interventionCount}</span>
        </div>
        <div className="bg-slate-700/30 rounded p-2">
          <span className="text-slate-400">Duration:</span>
          <span className="text-white ml-1">
            {stats.duration !== null ? `${stats.duration} min` : 'Active'}
          </span>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleExportJSON}
          disabled={disabled}
          className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
            disabled
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          📥 Download JSON
        </button>
        <button
          onClick={handleCopyToClipboard}
          disabled={disabled}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            disabled
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
              : 'bg-slate-600 hover:bg-slate-500 text-white'
          }`}
        >
          📋
        </button>
      </div>

      {/* Errors warning */}
      {stats.errorCount > 0 && (
        <div className="text-xs text-yellow-400 bg-yellow-900/20 rounded px-2 py-1">
          ⚠️ {stats.errorCount} error(s) logged during session
        </div>
      )}
    </div>
  );
}

