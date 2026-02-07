# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                           │
│                   (Next.js App Router)                          │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Route Handler                          │
│                    POST /api/analyze                            │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Input Normalizer                            │
│         (Parse JSON / curl / raw text → IncidentInput)          │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Incident Classifier                           │
│              (Fast model: gpt-4o-mini)                          │
│                                                                 │
│  • Error category (4xx/5xx/timeout/stream)                      │
│  • Fault domain (customer/openrouter/upstream)                  │
│  • Severity level                                               │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Incident Explainer                            │
│           (Strong model: claude-3.5-sonnet)                     │
│                                                                 │
│  • Root cause analysis                                          │
│  • Customer-facing explanation                                  │
│  • Mitigation recommendations                                   │
│  • Reproduction script                                          │
│  • Escalation notes                                             │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SQLite Database                            │
│                                                                 │
│  • Store incident for history                                   │
│  • Query similar past incidents                                 │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Incident Report                              │
│               (Rendered to user)                                │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
ita/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Main UI (input form + report display)
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Tailwind imports
│   │   └── api/
│   │       └── analyze/
│   │           └── route.ts      # POST endpoint for analysis
│   │
│   ├── lib/                      # Core logic
│   │   ├── openrouter.ts         # OpenRouter SDK client setup
│   │   ├── normalizer.ts         # Parse raw input → structured data
│   │   ├── classifier.ts         # Fast model: classify incident
│   │   ├── explainer.ts          # Strong model: generate report
│   │   ├── db.ts                 # SQLite operations
│   │   └── curl-generator.ts     # Generate reproduction curl
│   │
│   └── types/                    # TypeScript interfaces
│       └── incident.ts           # IncidentInput, Classification, Report
│
├── db/
│   └── incidents.db              # SQLite database file
│
├── docs/
│   ├── ARCHITECTURE.md           # This file
│   └── BUILD_PLAN.md             # Step-by-step build guide
│
├── .env.example                  # Environment template
├── .env.local                    # Local secrets (gitignored)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
└── README.md
```

## Core Modules

### 1. Input Normalizer (`src/lib/normalizer.ts`)

**Purpose**: Accept multiple input formats and normalize to structured data.

**Supported Inputs**:
- Raw JSON error object
- curl command (parse headers, body, URL)
- Plain text error description

**Output**: `IncidentInput` object

```typescript
interface IncidentInput {
  model?: string;
  error: {
    code: number;
    message: string;
  };
  latencyMs?: number;
  requestId?: string;
  rawInput: string;        // Original input preserved
  inputType: 'json' | 'curl' | 'text';
}
```

### 2. Incident Classifier (`src/lib/classifier.ts`)

**Purpose**: Quick classification using fast, cheap model.

**Model**: `openai/gpt-4o-mini`

**Why this model**: Fast, cheap, good at structured extraction.

**Output**: `IncidentClassification`

```typescript
interface IncidentClassification {
  errorCategory: '4xx' | '5xx' | 'timeout' | 'stream_abort' | 'unknown';
  faultDomain: 'customer' | 'openrouter' | 'upstream_provider';
  severity: 'low' | 'medium' | 'high' | 'critical';
  provider?: string;       // e.g., "anthropic", "openai"
  signals: string[];       // Evidence points
}
```

### 3. Incident Explainer (`src/lib/explainer.ts`)

**Purpose**: Generate human-readable, support-grade analysis.

**Model**: `anthropic/claude-3.5-sonnet`

**Why this model**: Strong reasoning, excellent at nuanced explanations.

**Output**: `IncidentReport`

```typescript
interface IncidentReport {
  rootCause: string;
  evidence: string[];
  customerImpact: string;
  mitigation: string[];
  reproductionScript: string;
  escalationNotes: string;
  similarIncidents?: SimilarIncident[];
}
```

### 4. Database (`src/lib/db.ts`)

**Purpose**: Persist incidents for history and pattern matching.

**Schema**:

```sql
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  raw_input TEXT,
  model TEXT,
  error_code INTEGER,
  error_message TEXT,
  fault_domain TEXT,
  severity TEXT,
  report TEXT  -- JSON blob of full report
);
```

**Operations**:
- `saveIncident(incident, report)` — Store after analysis
- `findSimilar(errorMessage, limit)` — Simple text matching

## Data Flow

### Request Lifecycle

```
1. User pastes failed request data into UI
2. UI sends POST to /api/analyze with raw input
3. Normalizer parses input → IncidentInput
4. Classifier calls gpt-4o-mini → IncidentClassification
5. Explainer calls claude-3.5-sonnet → IncidentReport
6. DB stores incident + report
7. DB queries for similar past incidents
8. API returns complete IncidentReport to UI
9. UI renders formatted report
```

### Multi-Model Strategy

This project showcases OpenRouter's routing value by using multiple models:

| Step | Model | Rationale |
|------|-------|-----------|
| Classification | `openai/gpt-4o-mini` | Fast, cheap, good at structured extraction |
| Explanation | `anthropic/claude-3.5-sonnet` | Strong reasoning, nuanced writing |

Fallback configuration:
```typescript
// If Claude is down, fall back to GPT-4o
models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o']
```

## Error Handling

The agent should gracefully handle:

1. **Invalid input** → Return parsing error with example format
2. **OpenRouter API failure** → Use fallback models
3. **DB failure** → Continue without history (log warning)
4. **Rate limiting** → Return 429 with retry-after

## Deployment

**Platform**: Railway

**Why Railway**:
- Native Next.js support
- Automatic HTTPS
- Easy environment variable management
- Deploy from GitHub
- Persistent volume storage (better for SQLite than serverless)

**Considerations**:
- SQLite can still be tricky across deploys
- For production: consider Railway's PostgreSQL or Turso
- For this demo: SQLite is fine
