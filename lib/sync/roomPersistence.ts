
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TranscriptSegment } from '@/lib/types';

const DATA_DIR = join(process.cwd(), 'data', 'rooms');

export interface RoomData {
  segments: TranscriptSegment[];
  lastUpdated: number;
}

function getRoomPath(roomId: string) {
  return join(DATA_DIR, `${roomId}.json`);
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getRoomData(roomId: string): RoomData {
  ensureDataDir();
  const path = getRoomPath(roomId);
  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      return data;
    } catch (e) {
      console.error(`Error reading room data for ${roomId}:`, e);
    }
  }
  return { segments: [], lastUpdated: Date.now() };
}

export function saveRoomData(roomId: string, data: RoomData) {
  ensureDataDir();
  const path = getRoomPath(roomId);
  try {
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error saving room data for ${roomId}:`, e);
  }
}

export function appendSegmentToRoom(roomId: string, segment: TranscriptSegment) {
  const data = getRoomData(roomId);
  // Check if segment already exists (by ID) to avoid duplicates
  if (!data.segments.some(s => s.id === segment.id)) {
      data.segments.push(segment);
      data.lastUpdated = Date.now();
      saveRoomData(roomId, data);
  }
}

