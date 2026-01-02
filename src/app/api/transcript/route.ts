import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface TranscriptEntry {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

interface SessionTranscript {
  sessionId: string;
  entries: TranscriptEntry[];
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
}

const TRANSCRIPTS_DIR = path.join(process.cwd(), 'transcripts');
const TRANSCRIPT_FILE = path.join(TRANSCRIPTS_DIR, 'transcript.json');

async function ensureTranscriptsDir() {
  if (!existsSync(TRANSCRIPTS_DIR)) {
    await mkdir(TRANSCRIPTS_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, messages, startTime, endTime } = await request.json();

    if (!sessionId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await ensureTranscriptsDir();

    const transcript: SessionTranscript = {
      sessionId,
      entries: messages.map((m: { role: string; content: string; timestamp: string }) => ({
        role: m.role as 'user' | 'ai',
        content: m.content,
        timestamp: m.timestamp,
      })),
      startTime: startTime || new Date().toISOString(),
      endTime: endTime || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeFile(TRANSCRIPT_FILE, JSON.stringify(transcript, null, 2));

    return NextResponse.json({ success: true, entryCount: transcript.entries.length });
  } catch (error) {
    console.error('Transcript API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await ensureTranscriptsDir();

    if (!existsSync(TRANSCRIPT_FILE)) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    const data = await readFile(TRANSCRIPT_FILE, 'utf-8');
    const transcript = JSON.parse(data);

    return NextResponse.json(transcript);
  } catch (error) {
    console.error('Transcript API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
