# OpenRouter Incident Triage Agent (ITA)

A support-grade incident analysis tool that diagnoses LLM API failures and produces actionable remediation reports.

## What It Does

Takes a failed OpenRouter request and produces analysis like:

> "This failure is most likely caused by upstream provider instability (Anthropic), not OpenRouter infrastructure. Suggested mitigation: failover to openai/gpt-4o-mini with reduced max_tokens."

## Features

- **Error Classification**: Categorizes incidents by type (4xx, 5xx, timeout, stream abort)
- **Fault Domain Isolation**: Distinguishes between customer bug, OpenRouter, or upstream provider
- **Impact Assessment**: Evaluates business impact and blast radius
- **Mitigation Recommendations**: Actionable steps to resolve or work around issues
- **Reproduction Scripts**: Auto-generated curl commands for debugging
- **Incident History**: Stores past incidents and finds similar patterns

## Example Input

```json
{
  "model": "anthropic/claude-3.5-sonnet",
  "error": {
    "code": 503,
    "message": "Upstream provider timed out"
  },
  "latency_ms": 14300
}
```

## Example Output

```
Root Cause:
Likely upstream provider timeout (Anthropic)

Evidence:
- HTTP 503
- Latency spike > 14s
- No malformed request indicators

Customer Impact:
High — production inference path affected

Immediate Mitigation:
- Enable fallback routing to openai/gpt-4o-mini
- Reduce max_tokens to 1024 temporarily

Reproduction Script:
curl -X POST https://openrouter.ai/api/v1/chat/completions ...

Escalation Notes:
No OpenRouter infra indicators. Monitor Anthropic latency.
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Framework | Next.js 14 (App Router) |
| API | OpenRouter SDK |
| Database | SQLite (better-sqlite3) |
| Styling | Tailwind CSS |
| Deployment | Railway |

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Add your OPENROUTER_API_KEY

# Run development server
pnpm dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |

## Disclaimer

This tool does not have access to internal OpenRouter logs or provider status systems. All analysis is based on request-level data provided by the user.

## License

MIT
