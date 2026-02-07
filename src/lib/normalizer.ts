import { IncidentInput } from '@/types/incident';

export function normalize(raw: string): IncidentInput {
  const trimmed = raw.trim();

  if (looksLikeJSON(trimmed)) {
    return parseJSON(trimmed);
  }

  if (looksLikeCurl(trimmed)) {
    return parseCurl(trimmed);
  }

  return parseText(trimmed);
}

function looksLikeJSON(input: string): boolean {
  return input.startsWith('{') || input.startsWith('[');
}

function looksLikeCurl(input: string): boolean {
  return input.toLowerCase().startsWith('curl');
}

function parseJSON(raw: string): IncidentInput {
  const parsed = JSON.parse(raw);

  const error = parsed.error ?? { code: 0, message: 'Unknown error' };

  return {
    model: parsed.model ?? undefined,
    error: {
      code: typeof error.code === 'number' ? error.code : Number(error.code) || 0,
      message: typeof error.message === 'string' ? error.message : String(error.message),
    },
    latencyMs: parsed.latency_ms ?? parsed.latencyMs ?? undefined,
    requestId: parsed.request_id ?? parsed.requestId ?? undefined,
    rawInput: raw,
    inputType: 'json',
  };
}

function parseCurl(raw: string): IncidentInput {
  const modelMatch = raw.match(/"model"\s*:\s*"([^"]+)"/);
  const errorMatch = raw.match(/"error"\s*:\s*(\{[^}]+\})/);
  const urlMatch = raw.match(/https?:\/\/[^\s"']+/);

  let errorCode = 0;
  let errorMessage = 'Could not parse error from curl command';

  if (errorMatch) {
    try {
      const errorObj = JSON.parse(errorMatch[1]);
      errorCode = errorObj.code ?? 0;
      errorMessage = errorObj.message ?? errorMessage;
    } catch {
      // keep defaults
    }
  }

  return {
    model: modelMatch?.[1] ?? undefined,
    error: {
      code: errorCode,
      message: errorMessage,
    },
    rawInput: raw,
    inputType: 'curl',
  };
}

function parseText(raw: string): IncidentInput {
  const codeMatch = raw.match(/\b(4\d{2}|5\d{2})\b/);
  const modelMatch = raw.match(/(anthropic|openai|google|meta)\/([\w.-]+)/i);

  return {
    model: modelMatch?.[0] ?? undefined,
    error: {
      code: codeMatch ? Number(codeMatch[1]) : 0,
      message: raw,
    },
    rawInput: raw,
    inputType: 'text',
  };
}
