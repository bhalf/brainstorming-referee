import { TranscriptSegment, ModelRoutingLogEntry } from '@/lib/types';

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
  const formData = new FormData();
  formData.append('audio', blob, `${idPrefix}.webm`);
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
        .filter((s: TranscriptSegment) => s.text.length > 0)
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
