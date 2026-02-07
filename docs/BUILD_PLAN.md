# Weekend Build Plan

A step-by-step guide to building the Incident Triage Agent in one weekend.

---

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 20+ installed
- [ ] pnpm installed (`npm install -g pnpm`)
- [ ] OpenRouter API key ([get one here](https://openrouter.ai/keys))
- [ ] GitHub account (for deployment)
- [ ] Vercel account (free tier)

---

## Day 1: Saturday — Core Engine

### Block 1: Project Setup (2 hours)

**Goal**: Bootable Next.js project with OpenRouter SDK configured.

**Steps**:

1. Initialize Next.js project
   ```bash
   pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir
   ```

2. Install dependencies
   ```bash
   pnpm add @openrouter/sdk better-sqlite3 uuid
   pnpm add -D @types/better-sqlite3 @types/uuid
   ```

3. Create `.env.local`
   ```
   OPENROUTER_API_KEY=sk-or-v1-xxxxx
   ```

4. Create OpenRouter client (`src/lib/openrouter.ts`)
   - Initialize SDK with API key
   - Add default headers for app attribution

5. Test connection
   - Create a simple test script
   - Verify API key works

**Learning**: Environment variables, SDK initialization, API authentication.

**Checkpoint**: Can make a successful API call to OpenRouter.

---

### Block 2: Input Normalizer (2 hours)

**Goal**: Parse any input format into structured `IncidentInput`.

**Steps**:

1. Define types (`src/types/incident.ts`)
   ```typescript
   export interface IncidentInput {
     model?: string;
     error: {
       code: number;
       message: string;
     };
     latencyMs?: number;
     requestId?: string;
     rawInput: string;
     inputType: 'json' | 'curl' | 'text';
   }
   ```

2. Create normalizer (`src/lib/normalizer.ts`)
   - `parseJSON(input)` — Handle JSON error objects
   - `parseCurl(input)` — Extract from curl commands
   - `parseText(input)` — Fallback for plain text
   - `normalize(input)` — Auto-detect and parse

3. Write tests (manual for now)
   - Test with sample JSON
   - Test with sample curl
   - Test with malformed input

**Learning**: TypeScript interfaces, parsing strategies, input validation.

**Checkpoint**: Can convert various input formats to structured data.

---

### Block 3: Incident Classifier (2 hours)

**Goal**: Use fast model to categorize the incident.

**Steps**:

1. Define classification types
   ```typescript
   export interface IncidentClassification {
     errorCategory: '4xx' | '5xx' | 'timeout' | 'stream_abort' | 'unknown';
     faultDomain: 'customer' | 'openrouter' | 'upstream_provider';
     severity: 'low' | 'medium' | 'high' | 'critical';
     provider?: string;
     signals: string[];
   }
   ```

2. Create classifier (`src/lib/classifier.ts`)
   - Write classification prompt
   - Call `openai/gpt-4o-mini`
   - Parse structured response

3. Prompt engineering
   - Include error code patterns
   - Include fault domain heuristics
   - Request JSON output

**Learning**: Prompt engineering, structured outputs, model selection.

**Checkpoint**: Can classify a sample error into correct category and domain.

---

### Block 4: Incident Explainer (2 hours)

**Goal**: Generate full support-grade report.

**Steps**:

1. Define report types
   ```typescript
   export interface IncidentReport {
     rootCause: string;
     evidence: string[];
     customerImpact: string;
     mitigation: string[];
     reproductionScript: string;
     escalationNotes: string;
   }
   ```

2. Create explainer (`src/lib/explainer.ts`)
   - Write detailed system prompt
   - Include classification as context
   - Call `anthropic/claude-3.5-sonnet`
   - Add fallback to `openai/gpt-4o`

3. Create curl generator (`src/lib/curl-generator.ts`)
   - Generate reproduction curl from incident data

**Learning**: Multi-model routing, fallbacks, complex prompts.

**Checkpoint**: Can generate a full incident report from classified input.

---

### Day 1 End State

By Saturday evening, you should have:

- [x] Working OpenRouter integration
- [x] Input normalizer for JSON/curl/text
- [x] Fast classifier (gpt-4o-mini)
- [x] Strong explainer (claude-3.5-sonnet)
- [x] Core pipeline: input → classification → report

Test end-to-end via CLI or simple script before moving to UI.

---

## Day 2: Sunday — UI & Deployment

### Block 5: Web UI (3 hours)

**Goal**: Simple, functional interface for the agent.

**Steps**:

1. Create main page (`src/app/page.tsx`)
   - Large textarea for input
   - "Analyze" button
   - Loading state
   - Report display area

2. Create API route (`src/app/api/analyze/route.ts`)
   - Accept POST with raw input
   - Run full pipeline
   - Return report JSON

3. Style with Tailwind
   - Clean, professional look
   - Good contrast for report sections
   - Mobile-friendly

4. Add error handling UI
   - Show parsing errors clearly
   - Handle API failures gracefully

**Learning**: Next.js App Router, React Server Components, API routes.

**Checkpoint**: Can paste input, click analyze, see formatted report.

---

### Block 6: Database & History (2 hours)

**Goal**: Store incidents and find similar past cases.

**Steps**:

1. Set up SQLite (`src/lib/db.ts`)
   - Initialize database
   - Create incidents table
   - Handle migrations

2. Implement operations
   - `saveIncident()` — Store after analysis
   - `findSimilar()` — Simple LIKE matching on error message
   - `getRecent()` — List recent incidents

3. Integrate with pipeline
   - Save after successful analysis
   - Query similar before returning report
   - Add to report output

4. (Optional) Add history page
   - List past incidents
   - Click to view full report

**Learning**: SQLite basics, async database operations.

**Checkpoint**: Incidents persist across page refreshes, similar incidents appear.

---

### Block 7: Polish & Deploy (2 hours)

**Goal**: Production-ready deployment.

**Steps**:

1. Final polish
   - Add loading spinners
   - Improve error messages
   - Add sample inputs (pre-fill buttons)
   - Add "copy report" button

2. Prepare for deployment
   - Create `.env.example`
   - Update README with screenshots
   - Test build locally (`pnpm build`)

3. Deploy to Vercel
   - Push to GitHub
   - Connect to Vercel
   - Add environment variables
   - Deploy

4. Test production
   - Verify API works
   - Test with real error scenarios
   - Share link!

**Learning**: Production deployment, environment management.

**Checkpoint**: Live URL you can share with the hiring manager.

---

## Sample Test Cases

Use these to validate your implementation:

### Test 1: Upstream Provider Timeout
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
**Expected**: Fault domain = upstream_provider, severity = high

### Test 2: Rate Limiting
```json
{
  "model": "openai/gpt-4o",
  "error": {
    "code": 429,
    "message": "Rate limit exceeded"
  }
}
```
**Expected**: Fault domain = customer OR openrouter, severity = medium

### Test 3: Invalid Request
```json
{
  "model": "openai/gpt-4o",
  "error": {
    "code": 400,
    "message": "Invalid request: messages array is required"
  }
}
```
**Expected**: Fault domain = customer, severity = low

### Test 4: Model Not Found
```json
{
  "model": "fake/nonexistent-model",
  "error": {
    "code": 404,
    "message": "Model not found"
  }
}
```
**Expected**: Fault domain = customer, severity = low

---

## Stretch Goals (If Time Permits)

- [ ] Streaming responses (show report as it generates)
- [ ] Dark mode toggle
- [ ] Export report as Markdown
- [ ] Embed latency chart (simple visualization)
- [ ] Add OpenRouter status page check

---

## Troubleshooting

### "API key not working"
- Check `.env.local` has correct key
- Verify key has credits on OpenRouter dashboard
- Ensure no trailing whitespace

### "SQLite not working on Vercel"
- Expected: Vercel has ephemeral filesystem
- For demo: Accept data loss on redeploy
- For production: Use Turso or PlanetScale

### "Claude model failing"
- Check OpenRouter dashboard for provider status
- Fallback should kick in automatically
- Verify fallback model is configured

---

## Success Criteria

By Sunday evening, you should be able to:

1. ✅ Share a live URL with the hiring manager
2. ✅ Paste a failed request and get a professional incident report
3. ✅ Demonstrate multi-model routing (fast classifier + strong explainer)
4. ✅ Show incident history with similar case detection
5. ✅ Explain how this mirrors real support engineering workflows
