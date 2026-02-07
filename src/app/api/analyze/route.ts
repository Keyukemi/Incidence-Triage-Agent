import { NextRequest, NextResponse } from 'next/server';
import { normalize } from '@/lib/normalizer';
import { classify } from '@/lib/classifier';
import { explain } from '@/lib/explainer';
let dbModule: typeof import('@/lib/db') | null = null;

async function getDB() {
  if (dbModule) return dbModule;
  try {
    dbModule = await import('@/lib/db');
    return dbModule;
  } catch {
    console.warn('[DB] SQLite not available — running without incident history');
    return null;
  }
}

const MAX_INPUT_LENGTH = 5000;

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+a/i,
  /output\s+your\s+system\s+prompt/i,
  /reveal\s+your\s+(system\s+)?prompt/i,
  /repeat\s+your\s+instructions/i,
];

function containsInjection(input: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawInput = body.input;

    if (!rawInput || typeof rawInput !== 'string' || rawInput.trim().length === 0) {
      return NextResponse.json(
        { error: 'Input is required. Paste a failed request, error JSON, or curl command.' },
        { status: 400 }
      );
    }

    if (rawInput.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `Input too long. Maximum ${MAX_INPUT_LENGTH} characters allowed.` },
        { status: 400 }
      );
    }

    if (containsInjection(rawInput)) {
      return NextResponse.json(
        { error: 'Input contains disallowed patterns.' },
        { status: 400 }
      );
    }

    const incident = normalize(rawInput);
    const classification = await classify(incident);
    const report = await explain(incident, classification);

    try {
      const db = await getDB();
      if (db) {
        const similarIncidents = db.findSimilar(incident.error.message);
        report.similarIncidents = similarIncidents;
        db.saveIncident(incident, classification, report);
      }
    } catch (dbError) {
      console.error('[DB] Database operation failed:', dbError);
    }

    return NextResponse.json({
      incident,
      classification,
      report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
