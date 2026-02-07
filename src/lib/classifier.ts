import client from '@/lib/openrouter';
import { IncidentInput, IncidentClassification } from '@/types/incident';

const SYSTEM_PROMPT = `You are an API incident classifier for OpenRouter, a unified LLM API gateway.

Analyze the following incident data and classify it.

Classify this incident by determining:

1. ERROR CATEGORY - One of:
   - "4xx": Client error (bad request, auth, not found)
   - "5xx": Server error (internal error, bad gateway, service unavailable)
   - "timeout": Request exceeded time limit
   - "stream_abort": Streaming response interrupted
   - "unknown": Cannot determine

2. FAULT DOMAIN - Who is most likely responsible:
   - "customer": Issue with the customer's request (bad params, auth, rate limit abuse)
   - "openrouter": Issue with OpenRouter's infrastructure
   - "upstream_provider": Issue with the model provider (Anthropic, OpenAI, etc.)

3. SEVERITY - Business impact level:
   - "low": Minor issue, easy workaround
   - "medium": Noticeable impact, workaround exists
   - "high": Significant impact, limited workarounds
   - "critical": Service down, no workaround

4. PROVIDER - Extract the provider name if identifiable (e.g., "anthropic", "openai")

5. SIGNALS - List 2-4 specific evidence points that support your classification

CLASSIFICATION RULES:
- 503 + high latency + upstream message → upstream_provider
- 400/401/403 → usually customer
- 429 → could be customer (over limit) or provider (capacity)
- 500 → could be openrouter or upstream
- Timeout > 30s → likely upstream_provider
- "rate limit" in message → check if user rate limit or provider

Respond with valid JSON only, no markdown:
{
  "errorCategory": "...",
  "faultDomain": "...",
  "severity": "...",
  "provider": "..." or null,
  "signals": ["...", "..."]
}`;

export async function classify(input: IncidentInput): Promise<IncidentClassification> {
  const userMessage = input.inputType === 'text'
    ? input.rawInput
    : JSON.stringify({
        model: input.model,
        error: input.error,
        latencyMs: input.latencyMs,
        requestId: input.requestId,
      }, null, 2);

  try {
    const response = await client.chat.send({
      chatGenerationParams: {
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `INCIDENT DATA:\n${userMessage}` },
        ],
        stream: false,
        temperature: 0,
      },
    });

    const rawContent = 'choices' in response
      ? response.choices?.[0]?.message?.content
      : undefined;
    const content = typeof rawContent === 'string' ? rawContent : undefined;
    if (!content) {
      return fallbackClassification(input);
    }

    const parsed = JSON.parse(content);
    return {
      errorCategory: parsed.errorCategory ?? 'unknown',
      faultDomain: parsed.faultDomain ?? 'unknown',
      severity: parsed.severity ?? 'medium',
      provider: parsed.provider ?? undefined,
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
    };
  } catch (error) {
    console.error('[Classifier] LLM call failed:', error);
    return fallbackClassification(input);
  }
}

function fallbackClassification(input: IncidentInput): IncidentClassification {
  const code = input.error.code;

  let errorCategory: IncidentClassification['errorCategory'] = 'unknown';
  if (code >= 400 && code < 500) errorCategory = '4xx';
  if (code >= 500 && code < 600) errorCategory = '5xx';

  let faultDomain: IncidentClassification['faultDomain'] = 'openrouter';
  if (code >= 400 && code < 500) faultDomain = 'customer';
  if (code >= 500) faultDomain = 'upstream_provider';

  return {
    errorCategory,
    faultDomain,
    severity: 'medium',
    provider: input.model?.split('/')[0] ?? undefined,
    signals: [`HTTP ${code}`, input.error.message],
  };
}
