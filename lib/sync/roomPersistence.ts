
import { existsSync, mkdirSync, writeFile, readFileSync } from 'fs';
import { join } from 'path';
import { TranscriptSegment } from '@/lib/types';

const DATA_DIR = join(process.cwd(), 'data', 'rooms');

export interface SessionConfig {
  scenario: string;
  language: string;
  encodedConfig: string;
}

export interface RoomData {
  segments: TranscriptSegment[];
  lastUpdated: number;
  sessionConfig?: SessionConfig;
}

// In-memory cache: eliminates disk reads on every poll request and also removes
// the read-modify-write race condition (JS is single-threaded, so synchronous
// cache operations are inherently atomic within one process).
const cache = new Map<string, RoomData>();

function getRoomPath(roomId: string) {
  return join(DATA_DIR, `${roomId}.json`);
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Write to disk asynchronously — fire-and-forget backup, never blocks the caller.
function persistToDisk(roomId: string, data: RoomData) {
  ensureDataDir();
  const path = getRoomPath(roomId);
  writeFile(path, JSON.stringify(data, null, 2), 'utf-8', (err) => {
    if (err) console.error(`Error persisting room data for ${roomId}:`, err);
  });
}

export function getRoomData(roomId: string): RoomData {
  // Serve from cache if available
  if (cache.has(roomId)) {
    return cache.get(roomId)!;
  }

  // Cold start: load from disk once, then keep in cache
  ensureDataDir();
  const path = getRoomPath(roomId);
  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, 'utf-8')) as RoomData;
      cache.set(roomId, data);
      return data;
    } catch (e) {
      console.error(`Error reading room data for ${roomId}:`, e);
    }
  }

  const empty: RoomData = { segments: [], lastUpdated: Date.now() };
  cache.set(roomId, empty);
  return empty;
}

export function saveRoomData(roomId: string, data: RoomData) {
  cache.set(roomId, data);
  persistToDisk(roomId, data);
}

export function saveSessionConfig(roomId: string, config: SessionConfig): void {
  const data = getRoomData(roomId);
  data.sessionConfig = config;
  data.lastUpdated = Date.now();
  persistToDisk(roomId, data);
}

export function appendSegmentToRoom(roomId: string, segment: TranscriptSegment) {
  const data = getRoomData(roomId);
  // Check if segment already exists (by ID) to avoid duplicates
  if (data.segments.some(s => s.id === segment.id)) return;

  data.segments.push(segment);
  data.lastUpdated = Date.now();
  // Cache is already mutated in place; persist async to disk
  persistToDisk(roomId, data);
}
