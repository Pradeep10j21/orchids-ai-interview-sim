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
  createdAt: string;
  updatedAt: string;
}

const TRANSCRIPTS_DIR = path.join(process.cwd(), 'transcripts');

async function ensureTranscriptsDir() {
  if (!existsSync(TRANSCRIPTS_DIR)) {
    await mkdir(TRANSCRIPTS_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, role, content, timestamp } = await request.json();

    if (!sessionId || !role || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await ensureTranscriptsDir();

    const filePath = path.join(TRANSCRIPTS_DIR, `${sessionId}.json`);
    
    let transcript: SessionTranscript;
    
    if (existsSync(filePath)) {
      const data = await readFile(filePath, 'utf-8');
      transcript = JSON.parse(data);
    } else {
      transcript = {
        sessionId,
        entries: [],
        createdAt: timestamp || new Date().toISOString(),
        updatedAt: timestamp || new Date().toISOString(),
      };
    }

    transcript.entries.push({
      role,
      content,
      timestamp: timestamp || new Date().toISOString(),
    });
    transcript.updatedAt = new Date().toISOString();

    await writeFile(filePath, JSON.stringify(transcript, null, 2));

    return NextResponse.json({ success: true, entryCount: transcript.entries.length });
  } catch (error) {
    console.error('Transcript API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    await ensureTranscriptsDir();

    const filePath = path.join(TRANSCRIPTS_DIR, `${sessionId}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    const data = await readFile(filePath, 'utf-8');
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
