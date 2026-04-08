'use client';

import { useState, useRef } from 'react';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface AudioUploaderProps {
  projectId: string;
  transcriptionLanguage: string;
  onComplete: () => void;
}

const ACCEPTED = '.mp3,.wav,.m4a,.webm,.ogg,.mp4,.mov,.avi,.mkv';
const MAX_CHUNK_DURATION_SEC = 180; // 3 minutes per chunk → ~2.8MB at 128kbps mono (Vercel limit 4.5MB)
const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|wmv|flv)$/i;

const LANG_OPTIONS = [
  { value: '', label: 'Auto-Detect' },
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'it', label: 'Italiano' },
  { value: 'es', label: 'Español' },
];

export default function AudioUploader({ projectId, transcriptionLanguage, onComplete }: AudioUploaderProps) {
  const lang = useIALang();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [audioLang, setAudioLang] = useState(transcriptionLanguage);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(f: File) {
    setFile(f);
    setName(f.name.replace(/\.[^.]+$/, ''));
    setError('');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    setProgress('');

    try {
      const isVideo = VIDEO_EXTENSIONS.test(file.name);
      const sizeMB = file.size / (1024 * 1024);

      // Small audio files (< 3.5MB, not video) → direct upload, skip ffmpeg
      if (!isVideo && sizeMB < 3.5) {
        setProgress(t('audio_transcribing', lang));
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name || file.name.replace(/\.[^.]+$/, ''));
        if (audioLang) formData.append('language', audioLang);

        const res = await fetch(`/api/interview-analysis/projects/${projectId}/transcribe`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = t('audio_failed', lang);
          try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
          throw new Error(msg);
        }
        setProgress(t('audio_done', lang));
        setTimeout(onComplete, 500);
        return;
      }

      // Large files or videos → split into time-based chunks with ffmpeg.wasm
      setProgress(isVideo
        ? (lang === 'en' ? 'Extracting audio from video...' : 'Audio wird aus Video extrahiert...')
        : (lang === 'en' ? 'Splitting audio...' : 'Audio wird aufgeteilt...'));
      const mp3Chunks = await splitToMp3Chunks(file);

      // Step 2: Upload each chunk to transcribe API
      let fullText = '';
      let interviewId: string | null = null;

      for (let i = 0; i < mp3Chunks.length; i++) {
        setProgress(`${t('audio_transcribing_part', lang)} ${i + 1}/${mp3Chunks.length}...`);
        const formData = new FormData();
        formData.append('file', mp3Chunks[i], `chunk_${i}.mp3`);
        formData.append('name', name || file.name.replace(/\.[^.]+$/, ''));
        if (audioLang) formData.append('language', audioLang);
        if (interviewId) formData.append('interviewId', interviewId);
        if (fullText) formData.append('previousText', fullText.slice(-200));

        const res = await fetch(`/api/interview-analysis/projects/${projectId}/transcribe`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const text = await res.text();
          let msg = t('audio_failed', lang);
          try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
          throw new Error(msg);
        }

        const data = await res.json();
        if (i === 0) interviewId = data.id;
        fullText += (fullText ? ' ' : '') + (data.transcript_text || '');
      }

      // Step 3: Update with combined transcript
      if (interviewId) {
        const patchRes = await fetch(`/api/interview-analysis/projects/${projectId}/interviews/${interviewId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript_text: fullText,
            word_count: fullText.trim().split(/\s+/).length,
            name: name || file.name.replace(/\.[^.]+$/, ''),
            status: 'transcribed',
          }),
        });
        if (!patchRes.ok) {
          const text = await patchRes.text();
          let msg = t('audio_failed', lang);
          try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
          throw new Error(msg);
        }
      }

      setProgress(t('audio_done', lang));
      setTimeout(onComplete, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('audio_failed', lang));
    } finally {
      setUploading(false);
    }
  }

  /**
   * Convert any audio/video file to time-based MP3 chunks using ffmpeg.wasm.
   * Step 1: Convert to single MP3 + detect duration from logs.
   * Step 2: Extract each chunk with -ss/-t for guaranteed complete output.
   */
  async function splitToMp3Chunks(inputFile: File): Promise<File[]> {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();
    await ffmpeg.load();

    let durationSec = 0;

    ffmpeg.on('log', ({ message }) => {
      // Capture duration from ffmpeg output
      const durMatch = message.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
      if (durMatch) {
        durationSec = parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseInt(durMatch[3]) + parseInt(durMatch[4]) / 100;
      }
      // Show progress
      const timeMatch = message.match(/time=(\d+):(\d+):(\d+)/);
      if (timeMatch) {
        const mins = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
        setProgress(lang === 'en' ? `Converting... ${mins} min done` : `Konvertierung... ${mins} Min. fertig`);
      }
    });

    const ext = inputFile.name.split('.').pop()?.toLowerCase() || 'mp3';
    const inputName = `input.${ext}`;
    await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

    // Step 1: Convert entire file to a single MP3
    setProgress(lang === 'en' ? 'Converting audio...' : 'Audio wird konvertiert...');
    await ffmpeg.exec([
      '-i', inputName,
      '-vn', '-acodec', 'libmp3lame', '-ab', '128k', '-ar', '16000', '-ac', '1',
      'full.mp3',
    ]);

    // Fallback duration estimate if not detected
    if (durationSec <= 0) {
      try {
        const fullData = await ffmpeg.readFile('full.mp3');
        // 128kbps mono = 16000 bytes/sec
        durationSec = (fullData as Uint8Array).length / 16000;
      } catch {
        durationSec = 600; // fallback 10 min
      }
    }

    // Add 10% buffer to duration to ensure we don't miss the tail
    const safeDuration = durationSec * 1.1 + 30;
    const numChunks = Math.max(1, Math.ceil(safeDuration / MAX_CHUNK_DURATION_SEC));
    const chunks: File[] = [];

    if (numChunks === 1) {
      // Single chunk — use the full MP3
      const data = await ffmpeg.readFile('full.mp3');
      // @ts-expect-error -- FileData is Uint8Array at runtime
      chunks.push(new File([data], 'chunk_0.mp3', { type: 'audio/mpeg' }));
    } else {
      // Step 2: Extract each chunk with -ss and re-encode for frame-accurate splits
      for (let i = 0; i < numChunks; i++) {
        const startSec = i * MAX_CHUNK_DURATION_SEC;
        const isLast = i === numChunks - 1;
        setProgress(lang === 'en'
          ? `Splitting chunk ${i + 1}/${numChunks}...`
          : `Aufteilen ${i + 1}/${numChunks}...`);

        const outName = `chunk_${i}.mp3`;
        // Last chunk: no -t limit → captures everything until the end
        // Re-encode (not copy) for frame-accurate boundaries → no repeated audio
        const args = [
          '-i', 'full.mp3',
          '-ss', String(startSec),
          ...(isLast ? [] : ['-t', String(MAX_CHUNK_DURATION_SEC)]),
          '-acodec', 'libmp3lame', '-ab', '128k', '-ar', '16000', '-ac', '1',
          outName,
        ];
        await ffmpeg.exec(args);

        try {
          const data = await ffmpeg.readFile(outName);
          // @ts-expect-error -- FileData is Uint8Array at runtime
          const f = new File([data], outName, { type: 'audio/mpeg' });
          if (f.size > 500) chunks.push(f); // skip empty chunks
        } catch {
          break;
        }
      }
    }

    ffmpeg.terminate();

    if (chunks.length === 0) {
      throw new Error('Audio processing failed — no output generated');
    }

    return chunks;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ia-text-secondary)' }}>
            {t('audio_name', lang)}
          </label>
          <input
            className="ia-input"
            placeholder={t('audio_name_placeholder', lang)}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div style={{ width: 140 }}>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ia-text-secondary)' }}>
            {lang === 'en' ? 'Language' : 'Sprache'}
          </label>
          <select
            className="ia-input"
            value={audioLang}
            onChange={(e) => setAudioLang(e.target.value)}
          >
            {LANG_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Premium Drop Zone */}
      <div
        className={`ia-upload-zone ${dragOver ? 'ia-upload-zone--active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        {file ? (
          <>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--ia-success-light)', color: 'var(--ia-success)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ia-text)' }}>
              {file.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--ia-text-tertiary)' }}>
              {(file.size / (1024 * 1024)).toFixed(1)} MB — {t('audio_click_change', lang)}
            </p>
          </>
        ) : (
          <>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--ia-accent-light)', color: 'var(--ia-accent)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: 'var(--ia-text)' }}>
                {t('audio_drop', lang)}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ia-text-tertiary)' }}>
                {t('audio_formats', lang)}
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--ia-error-light)', color: 'var(--ia-error)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="text-xs font-medium">{error}</span>
        </div>
      )}

      {progress && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--ia-warning-light)', color: 'var(--ia-warning)' }}>
          <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: 'var(--ia-warning)', borderTopColor: 'transparent' }} />
          <span className="text-xs font-medium">{progress}</span>
        </div>
      )}

      <button
        className="ia-btn ia-btn-primary w-full"
        disabled={!file || uploading}
        onClick={handleUpload}
      >
        {uploading ? (
          <>
            <span className="ia-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            {t('audio_transcribing', lang)}
          </>
        ) : t('audio_start', lang)}
      </button>
    </div>
  );
}

