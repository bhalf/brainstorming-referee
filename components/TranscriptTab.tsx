'use client';

import { useState } from 'react';
import { TranscriptControlProps } from './OverlayPanel';
import TranscriptFeed from './TranscriptFeed';

/**
 * Transcript tab displaying live transcription feed with recording controls.
 * Shows different UIs depending on transcription mode: real-time speech recognition,
 * server-side Whisper, or manual text simulation fallback.
 *
 * @param transcript - Transcription state including segments, controls, and error info.
 */
export default function TranscriptTab({ transcript }: { transcript: TranscriptControlProps }) {
  const [simText, setSimText] = useState('');

  // Determine which transcription mode UI to show based on capability detection
  const showSpeechControls = transcript.isTranscriptionSupported;
  const showWhisperStatus = !showSpeechControls && transcript.isWhisperActive;
  const showSimulation = !showSpeechControls && !showWhisperStatus;

  return (
    <div className="h-full flex flex-col">
      {/* Transcription Controls */}
      <div className="p-3 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showSpeechControls ? (
            transcript.isTranscribing ? (
              // Connected & recording — show Stop button
              <button
                onClick={transcript.onToggleTranscription}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-600/80 hover:bg-red-600 text-white"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Recording 🎤
              </button>
            ) : (
              // Not yet connected — show pulsing "Connecting..." indicator
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                Connecting…
              </span>
            )
          ) : showWhisperStatus ? (
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-900/40 text-green-300 border border-green-700/50">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Transcription Active
            </span>
          ) : (
            <span className="text-xs text-yellow-400">
              ⚠️ Simulation mode (no mic)
            </span>
          )}
        </div>
        {transcript.segments.length > 0 && (
          <span className="text-xs text-slate-500">
            {transcript.segments.length} segments
          </span>
        )}
      </div>

      {/* Error display */}
      {transcript.transcriptionError && (
        <div className="px-3 py-2 bg-red-900/30 text-red-400 text-xs">
          {transcript.transcriptionError}
        </div>
      )}

      {/* Simulation Input (fallback when no mic and no Whisper) */}
      {showSimulation && transcript.onAddSimulatedSegment && (
        <div className="px-3 py-2 border-b border-slate-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={simText}
              onChange={(e) => setSimText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && simText.trim()) {
                  transcript.onAddSimulatedSegment!(simText.trim());
                  setSimText('');
                }
              }}
              placeholder="Paste/type transcript..."
              className="flex-1 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={() => {
                if (simText.trim()) {
                  transcript.onAddSimulatedSegment!(simText.trim());
                  setSimText('');
                }
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Transcript Feed */}
      <div className="flex-1 overflow-hidden p-3">
        <TranscriptFeed
          segments={transcript.segments}
          interimEntries={transcript.interimEntries}
          showTimestamps={true}
        />
      </div>
    </div>
  );
}
