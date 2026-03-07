import { TranscriptSegment, ModelRoutingLogEntry } from '@/lib/types';
import { isWhisperHallucination } from './whisperHallucinationFilter';

interface TranscriptionChunkParams {
  blob: Blob;
  timestamp: number;
  language: string;
  speaker: string;
  idPrefix: string;
  addModelRoutingLog: (entry: ModelRoutingLogEntry) => void;
}

interface TranscriptionResult {
  segments: TranscriptSegment[];
  error?: string;
}

/**
 * Shared utility for sending audio chunks to the transcription API
 * and creating TranscriptSegments from the response.
 * Used by both microphone (Whisper) and tab audio capture.
 */
export async function processTranscriptionChunk({
  blob,
  timestamp,
  language,
  speaker,
  idPrefix,
  addModelRoutingLog,
}: TranscriptionChunkParams): Promise<TranscriptionResult> {
  // Determine file extension from blob MIME type
  const mimeToExt: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/webm;codecs=opus': 'webm',
    'audio/ogg': 'ogg',
    'audio/ogg;codecs=opus': 'ogg',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/flac': 'flac',
  };
  const ext = mimeToExt[blob.type] || 'webm';

  const formData = new FormData();
  formData.append('audio', blob, `${idPrefix}.${ext}`);
  formData.append('language', language);

  const response = await fetch('/api/transcription', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    if (errData.logEntry) addModelRoutingLog(errData.logEntry);
    return { segments: [], error: errData.error || `Transcription failed: ${response.status}` };
  }

  const data = await response.json();
  if (data.logEntry) addModelRoutingLog(data.logEntry);

  if (!data.text || data.text.trim().length === 0) {
    return { segments: [] };
  }

  // Filter Whisper hallucinations (fake subtitle text on silence)
  if (isWhisperHallucination(data.text)) {
    console.log('[Transcription] Filtered Whisper hallucination:', data.text.substring(0, 80));
    return { segments: [] };
  }

  const segments: TranscriptSegment[] = (data.segments && data.segments.length > 0)
    ? data.segments
        .map((seg: { start: number; end: number; text: string }, idx: number) => ({
          id: `${idPrefix}-${timestamp}-${idx}`,
          speaker,
          text: seg.text.trim(),
          timestamp: timestamp + (seg.start * 1000),
          isFinal: true,
          language,
        }))
        .filter((s: TranscriptSegment) => s.text.length > 0 && !isWhisperHallucination(s.text))
    : [{
        id: `${idPrefix}-${timestamp}-0`,
        speaker,
        text: data.text.trim(),
        timestamp,
        isFinal: true,
        language,
      }];

  return { segments };
}
