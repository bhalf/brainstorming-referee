import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getOpenAIClient } from '@/lib/openai';
import { writeFile, readFile, unlink } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

export const maxDuration = 300; // Vercel hobby plan limit

const execFileAsync = promisify(execFile);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv']);

/** Extract audio from video file using ffmpeg. Returns null if not a video. */
async function extractAudioFromVideo(
  fileBuffer: Buffer,
  originalName: string
): Promise<File | null> {
  const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
  if (!VIDEO_EXTENSIONS.has(ext)) return null;

  const id = randomUUID();
  const inputPath = join(tmpdir(), `ia_${id}.${ext}`);
  const outputPath = join(tmpdir(), `ia_${id}.mp3`);

  try {
    await writeFile(inputPath, fileBuffer);
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-vn',                    // strip video
      '-acodec', 'libmp3lame',  // MP3 output
      '-ab', '128k',            // 128kbps bitrate
      '-ar', '16000',           // 16kHz (speech-optimized)
      '-ac', '1',               // mono
      '-y',                     // overwrite output
      outputPath,
    ], { timeout: 300_000 }); // 5 min timeout

    const audioBuffer = await readFile(outputPath);
    const audioName = originalName.replace(/\.[^.]+$/, '.mp3');
    return new File([audioBuffer], audioName, { type: 'audio/mpeg' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ENOENT') || msg.includes('not found')) {
      throw new Error('ffmpeg is not installed. Install ffmpeg to process video files.');
    }
    throw new Error(`Audio extraction failed: ${msg}`);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const interviewId = formData.get('interviewId') as string | null;
  const interviewName = formData.get('name') as string | null;
  const language = (formData.get('language') as string) || 'de';
  const previousText = (formData.get('previousText') as string) || '';

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const sb = getServiceClient();
  const openai = getOpenAIClient();

  // Create interview record if no interviewId given
  let iId = interviewId;
  if (!iId) {
    const name = interviewName || file.name.replace(/\.[^.]+$/, '');
    const { data, error } = await sb
      .from('ia_interviews')
      .insert({
        project_id: projectId,
        name,
        source_type: 'audio',
        status: 'transcribing',
        metadata: { original_filename: file.name, size_bytes: file.size },
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    iId = data.id;
  } else {
    // Mark as transcribing
    await sb.from('ia_interviews').update({ status: 'transcribing' }).eq('id', iId);
  }

  try {
    // Extract audio from video if needed
    const buffer = Buffer.from(await file.arrayBuffer());
    let audioFile: File;
    try {
      const extracted = await extractAudioFromVideo(buffer, file.name);
      audioFile = extracted ?? file;
    } catch (extractErr) {
      // If extraction fails, return error (don't try raw video with Whisper)
      await sb.from('ia_interviews').update({ status: 'pending' }).eq('id', iId);
      const msg = extractErr instanceof Error ? extractErr.message : 'Video processing failed';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // Transcribe via OpenAI — use gpt-4o-transcribe for best accuracy
    // Pass last ~200 chars of previous chunk as prompt to improve boundary continuity
    const prompt = previousText
      ? previousText.slice(-200)
      : language === 'de'
        ? 'Dies ist ein Interview-Transkript auf Deutsch.'
        : 'This is an interview transcript.';

    const transcription = await openai.audio.transcriptions.create({
      model: 'gpt-4o-transcribe',
      file: audioFile,
      language,
      prompt,
      response_format: 'json',
    });

    const fullText = (transcription as unknown as { text: string }).text;
    const wordCount = fullText.trim().split(/\s+/).length;

    // Update interview with transcript
    const { data, error } = await sb
      .from('ia_interviews')
      .update({
        transcript_text: fullText,
        status: 'transcribed',
        word_count: wordCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', iId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    // Mark as failed
    await sb.from('ia_interviews').update({ status: 'pending' }).eq('id', iId);
    const msg = err instanceof Error ? err.message : 'Transcription failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
