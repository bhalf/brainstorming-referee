'use client';

import { useState, useRef } from 'react';
import { useIALang, t } from '@/lib/interview-analysis/i18n';

interface AudioUploaderProps {
  projectId: string;
  transcriptionLanguage: string;
  onComplete: () => void;
}

const ACCEPTED = '.mp3,.wav,.m4a,.webm,.ogg,.mp4,.mov,.avi,.mkv';
const MAX_CHUNK_SIZE_MB = 4; // Vercel serverless payload limit is 4.5MB
const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|mkv|wmv|flv)$/i;

export default function AudioUploader({ projectId, transcriptionLanguage, onComplete }: AudioUploaderProps) {
  const lang = useIALang();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
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
      let audioFile = file;

      // Convert video to MP3 client-side using ffmpeg.wasm
      if (isVideo) {
        setProgress(lang === 'en' ? 'Extracting audio from video...' : 'Audio wird aus Video extrahiert...');
        audioFile = await convertVideoToMp3(file);
      }

      // Now upload the audio file in chunks
      await uploadChunked(audioFile);

      setTimeout(onComplete, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('audio_failed', lang));
    } finally {
      setUploading(false);
    }
  }

  /** Convert video to MP3 using ffmpeg.wasm (runs in browser) */
  async function convertVideoToMp3(videoFile: File): Promise<File> {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();
    await ffmpeg.load();

    const inputName = `input.${videoFile.name.split('.').pop()}`;
    const outputName = 'output.mp3';

    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
    await ffmpeg.exec([
      '-i', inputName,
      '-vn',             // strip video
      '-acodec', 'libmp3lame',
      '-ab', '128k',
      '-ar', '16000',    // 16kHz speech-optimized
      '-ac', '1',        // mono
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    // @ts-expect-error -- ffmpeg.wasm FileData is Uint8Array at runtime
    const mp3Blob = new Blob([data], { type: 'audio/mpeg' });
    const mp3Name = videoFile.name.replace(/\.[^.]+$/, '.mp3');

    // Cleanup
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
    ffmpeg.terminate();

    return new File([mp3Blob], mp3Name, { type: 'audio/mpeg' });
  }

  /** Upload audio file, chunked if needed */
  async function uploadChunked(audioFile: File) {
    const sizeMB = audioFile.size / (1024 * 1024);

    if (sizeMB <= MAX_CHUNK_SIZE_MB) {
      // Small file — single upload
      setProgress(t('audio_transcribing', lang));
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('name', name || file!.name.replace(/\.[^.]+$/, ''));
      formData.append('language', transcriptionLanguage);

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
      return;
    }

    // Large file — chunk and upload
    setProgress(t('audio_splitting', lang));
    const chunks = chunkFile(audioFile, MAX_CHUNK_SIZE_MB * 1024 * 1024);
    let fullText = '';
    let interviewId: string | null = null;

    for (let i = 0; i < chunks.length; i++) {
      setProgress(`${t('audio_transcribing_part', lang)} ${i + 1}/${chunks.length}...`);
      const formData = new FormData();
      formData.append('file', chunks[i], `chunk_${i}.mp3`);
      formData.append('name', name || file!.name.replace(/\.[^.]+$/, ''));
      formData.append('language', transcriptionLanguage);
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

    // Update with combined transcript
    if (interviewId) {
      await fetch(`/api/interview-analysis/projects/${projectId}/interviews/${interviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript_text: fullText,
          word_count: fullText.trim().split(/\s+/).length,
          name: name || file!.name.replace(/\.[^.]+$/, ''),
        }),
      });
    }

    setProgress(t('audio_done', lang));
  }

  return (
    <div className="space-y-4">
      <div>
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

function chunkFile(file: File | Blob, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < file.size) {
    chunks.push(file.slice(offset, offset + chunkSize));
    offset += chunkSize;
  }
  return chunks;
}
