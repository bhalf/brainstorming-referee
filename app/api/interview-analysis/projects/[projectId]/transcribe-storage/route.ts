import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';
import { writeFile, readFile, unlink } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

export const maxDuration = 300;

const execFileAsync = promisify(execFile);

/**
 * Transcribe a file that was uploaded to Supabase Storage.
 * Used for large files (video + audio > 4MB) that can't be sent directly
 * due to Vercel's 4.5MB body size limit.
 *
 * Flow: Client uploads to Storage → calls this endpoint → Server downloads,
 * extracts audio (if video), splits into ≤25MB chunks, transcribes, cleans up.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await req.json();
  const { storagePath, name, language = 'de' } = body as {
    storagePath: string;
    name?: string;
    language?: string;
  };

  if (!storagePath) {
    return NextResponse.json({ error: 'storagePath is required' }, { status: 400 });
  }

  const sb = getServiceClient();
  const openai = getOpenAIClient();

  // Create interview record
  const displayName = name || storagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Interview';
  const { data: interview, error: insertErr } = await sb
    .from('ia_interviews')
    .insert({
      project_id: projectId,
      name: displayName,
      source_type: 'audio',
      status: 'transcribing',
      metadata: { storage_path: storagePath },
    })
    .select('id')
    .single();

  if (insertErr || !interview) {
    return NextResponse.json({ error: insertErr?.message || 'Failed to create interview' }, { status: 500 });
  }

  const interviewId = interview.id;

  try {
    // Download file from Supabase Storage
    const { data: fileData, error: dlErr } = await sb.storage
      .from('ia-uploads')
      .download(storagePath);

    if (dlErr || !fileData) {
      throw new Error(`Storage download failed: ${dlErr?.message || 'No data'}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const ext = storagePath.split('.').pop()?.toLowerCase() || '';
    const id = randomUUID();

    // Convert to MP3 (works for both video and non-MP3 audio)
    const inputPath = join(tmpdir(), `ia_${id}.${ext}`);
    const mp3Path = join(tmpdir(), `ia_${id}.mp3`);

    await writeFile(inputPath, buffer);

    try {
      await execFileAsync('ffmpeg', [
        '-i', inputPath,
        '-vn',               // strip video
        '-acodec', 'libmp3lame',
        '-ab', '128k',
        '-ar', '16000',      // 16kHz (speech-optimized)
        '-ac', '1',          // mono
        '-y',
        mp3Path,
      ], { timeout: 300_000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ENOENT') || msg.includes('not found')) {
        throw new Error('ffmpeg is not installed on the server.');
      }
      throw new Error(`Audio extraction failed: ${msg}`);
    } finally {
      await unlink(inputPath).catch(() => {});
    }

    // Read the MP3 and split into ≤24MB chunks for Whisper (25MB limit)
    const mp3Buffer = await readFile(mp3Path);
    await unlink(mp3Path).catch(() => {});

    const MAX_WHISPER_BYTES = 24 * 1024 * 1024;
    const chunks: Buffer[] = [];
    let offset = 0;
    while (offset < mp3Buffer.length) {
      chunks.push(mp3Buffer.subarray(offset, offset + MAX_WHISPER_BYTES));
      offset += MAX_WHISPER_BYTES;
    }

    // Transcribe each chunk
    let fullText = '';
    for (let i = 0; i < chunks.length; i++) {
      const chunkFile = new File([new Uint8Array(chunks[i])], `chunk_${i}.mp3`, { type: 'audio/mpeg' });

      const prompt = fullText
        ? fullText.slice(-200)
        : language === 'de'
          ? 'Dies ist ein Interview-Transkript auf Deutsch.'
          : 'This is an interview transcript.';

      const transcription = await openai.audio.transcriptions.create({
        model: 'gpt-4o-transcribe',
        file: chunkFile,
        language,
        prompt,
        response_format: 'json',
      });

      const text = (transcription as unknown as { text: string }).text;
      fullText += (fullText ? ' ' : '') + text;
    }

    // Update interview with combined transcript
    const wordCount = fullText.trim().split(/\s+/).length;
    const { data, error } = await sb
      .from('ia_interviews')
      .update({
        transcript_text: fullText,
        status: 'transcribed',
        word_count: wordCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', interviewId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Clean up storage file
    await sb.storage.from('ia-uploads').remove([storagePath]).catch(() => {});

    return NextResponse.json(data);
  } catch (err) {
    await sb.from('ia_interviews').update({ status: 'pending' }).eq('id', interviewId);
    const msg = err instanceof Error ? err.message : 'Transcription failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
