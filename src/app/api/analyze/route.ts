import { NextRequest, NextResponse } from 'next/server';
import { normalize } from '@/lib/normalizer';
import { classify } from '@/lib/classifier';
import { explain } from '@/lib/explainer';

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

    const incident = normalize(rawInput);
    const classification = await classify(incident);
    const report = await explain(incident, classification);

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
