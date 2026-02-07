import client from '@/lib/openrouter';
import { IncidentInput, IncidentClassification, IncidentReport } from '@/types/incident';

const SYSTEM_PROMPT = `You are a senior support engineer at OpenRouter, a unified LLM API gateway that routes requests to multiple AI providers (OpenAI, Anthropic, Google, etc.).

Your job is to analyze incidents and produce clear, actionable reports for customers and internal escalation.

Generate a comprehensive incident report with the following sections:

## ROOT CAUSE
One clear sentence stating the most likely cause. Be specific but not speculative.

## EVIDENCE
List 3-5 specific observations from the incident data that support your root cause analysis.

## CUSTOMER IMPACT
Describe the impact on the customer in plain language. Consider:
- Is this blocking production traffic?
- What functionality is affected?
- How many users might be impacted?

## IMMEDIATE MITIGATION
List 2-4 actionable steps the customer can take RIGHT NOW. Be specific:
- If suggesting fallback, name specific alternative models
- If suggesting parameter changes, give exact values
- If suggesting retry, give backoff strategy

## REPRODUCTION SCRIPT
Generate a minimal curl command that would reproduce this error. Use placeholder API key.

## ESCALATION NOTES
Brief notes for internal escalation. Include:
- Whether this requires provider notification
- Any patterns or trends to watch
- Recommended monitoring

TONE: Calm, professional, solution-focused. Avoid blame language.

Respond with valid JSON only, no markdown:
{
  "rootCause": "...",
  "evidence": ["...", "..."],
  "customerImpact": "...",
  "mitigation": ["...", "..."],
  "reproductionScript": "curl ...",
  "escalationNotes": "..."
}`;

export async function explain(
  input: IncidentInput,
  classification: IncidentClassification
): Promise<IncidentReport> {
  const incidentData = input.inputType === 'text'
    ? input.rawInput
    : JSON.stringify({
        model: input.model,
        error: input.error,
        latencyMs: input.latencyMs,
        requestId: input.requestId,
      }, null, 2);

  const userMessage = `INCIDENT DATA:
${incidentData}

CLASSIFICATION (from initial triage):
${JSON.stringify(classification, null, 2)}`;

  try {
    const response = await client.chat.send({
      chatGenerationParams: {
        models: [
          'anthropic/claude-3.5-sonnet',
          'openai/gpt-4o',
        ],
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        stream: false,
        temperature: 0.2,
      },
    });

    const rawContent = 'choices' in response
      ? response.choices?.[0]?.message?.content
      : undefined;
    const content = typeof rawContent === 'string' ? rawContent : undefined;
    if (!content) {
      return fallbackReport(input, classification);
    }

    const parsed = JSON.parse(content);
    return {
      rootCause: parsed.rootCause ?? 'Unable to determine root cause',
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      customerImpact: parsed.customerImpact ?? 'Impact unknown',
      mitigation: Array.isArray(parsed.mitigation) ? parsed.mitigation : [],
      reproductionScript: parsed.reproductionScript ?? '',
      escalationNotes: parsed.escalationNotes ?? '',
    };
  } catch (error) {
    console.error('[Explainer] LLM call failed:', error);
    return fallbackReport(input, classification);
  }
}

function fallbackReport(
  input: IncidentInput,
  classification: IncidentClassification
): IncidentReport {
  const model = input.model ?? 'unknown model';
  const code = input.error.code;
  const shortMessage = input.error.message.slice(0, 150);

  return {
    rootCause: code > 0
      ? `HTTP ${code} error from ${model}: ${shortMessage}`
      : `Incident reported for ${model}: ${shortMessage}`,
    evidence: [
      ...(code > 0 ? [`HTTP status code: ${code}`] : []),
      `Error summary: ${shortMessage}`,
      ...classification.signals,
    ],
    customerImpact: classification.severity === 'high' || classification.severity === 'critical'
      ? 'Production traffic is likely affected.'
      : 'Limited impact expected.',
    mitigation: [
      'Retry the request with exponential backoff',
      'Consider switching to a fallback model',
    ],
    reproductionScript: buildCurl(input),
    escalationNotes: `Fault domain: ${classification.faultDomain}. Monitor for recurrence.`,
  };
}

function buildCurl(input: IncidentInput): string {
  const body = {
    model: input.model ?? 'openai/gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello' }],
  };

  return `curl -X POST https://openrouter.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`;
}
