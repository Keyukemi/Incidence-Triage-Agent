'use client';

import { useState } from 'react';
import { IncidentClassification, IncidentReport } from '@/types/incident';

const SAMPLE_INPUTS = [
  {
    label: '503 — Provider Timeout',
    value: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      error: { code: 503, message: 'Upstream provider timed out' },
      latency_ms: 14300,
    }, null, 2),
  },
  {
    label: '429 — Rate Limited',
    value: JSON.stringify({
      model: 'openai/gpt-4o',
      error: { code: 429, message: 'Rate limit exceeded' },
    }, null, 2),
  },
  {
    label: '400 — Bad Request',
    value: JSON.stringify({
      model: 'openai/gpt-4o',
      error: { code: 400, message: 'Invalid request: messages array is required' },
    }, null, 2),
  },
  {
    label: 'Text — Bug Report',
    value: `Model: anthropic/claude-3.5-sonnet
Issue: Intermittent 502 Bad Gateway errors during peak hours (2-4pm EST).
Affects roughly 30% of requests. Latency spikes to 25s before failing.
Workaround: Manually retrying works after 10-15 seconds.
Started happening 2 days ago, no changes on our side.`,
  },
];

interface AnalysisResult {
  classification: IncidentClassification;
  report: IncidentReport;
}

export default function Home() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    if (!input.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Analysis failed');
        return;
      }

      setResult({ classification: data.classification, report: data.report });
    } catch {
      setError('Failed to connect to the analysis API');
    } finally {
      setLoading(false);
    }
  }

  function handleCopyReport() {
    if (!result) return;
    const text = formatReportAsText(result);
    navigator.clipboard.writeText(text);
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#ededed] font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 rounded-full">
              OpenRouter Native
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Incident Triage Agent
          </h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-2xl">
            Paste a failed API request, error JSON, curl command, or plain-text bug report.
            This agent classifies the incident, isolates the fault domain, and generates
            a support-grade analysis with actionable mitigation steps.
          </p>
          <p className="text-xs text-neutral-600 mt-2">
            Uses gpt-4o-mini for fast classification · claude-3.5-sonnet for deep analysis
          </p>
        </header>

        <section className="mb-8">
          <label className="block text-sm font-medium text-neutral-300 mb-2">
            Paste a failed request, error JSON, or curl command
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'{\n  "model": "anthropic/claude-3.5-sonnet",\n  "error": {\n    "code": 503,\n    "message": "Upstream provider timed out"\n  },\n  "latency_ms": 14300\n}'}
            className="w-full h-48 bg-[#141414] border border-neutral-800 rounded-lg p-4 text-sm font-[family-name:var(--font-geist-mono)] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleAnalyze}
              disabled={loading || !input.trim()}
              className="px-5 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>

            {(input || result || error) && (
              <button
                onClick={() => { setInput(''); setResult(null); setError(''); }}
                className="px-4 py-2 text-sm text-neutral-400 border border-neutral-800 rounded-lg hover:border-neutral-600 hover:text-neutral-200 transition-colors"
              >
                Clear
              </button>
            )}

            <div className="flex gap-2">
              {SAMPLE_INPUTS.map((sample) => (
                <button
                  key={sample.label}
                  onClick={() => setInput(sample.value)}
                  className="px-3 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-md hover:border-neutral-600 hover:text-neutral-200 transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-8 p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-8 p-6 bg-[#141414] border border-neutral-800 rounded-lg">
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              <div className="h-4 w-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
              Running incident analysis pipeline...
            </div>
          </div>
        )}

        {result && <ReportDisplay result={result} onCopy={handleCopyReport} />}
      </div>
    </main>
  );
}

function ReportDisplay({ result, onCopy }: { result: AnalysisResult; onCopy: () => void }) {
  const { classification, report } = result;

  const severityColor: Record<string, string> = {
    low: 'text-green-400 bg-green-950/30 border-green-900/50',
    medium: 'text-yellow-400 bg-yellow-950/30 border-yellow-900/50',
    high: 'text-orange-400 bg-orange-950/30 border-orange-900/50',
    critical: 'text-red-400 bg-red-950/30 border-red-900/50',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Incident Report</h2>
        <button
          onClick={onCopy}
          className="px-3 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-md hover:border-neutral-600 hover:text-neutral-200 transition-colors"
        >
          Copy Report
        </button>
      </div>

      <div className="flex gap-3">
        <span className={`px-3 py-1 text-xs font-medium rounded-full border ${severityColor[classification.severity] || ''}`}>
          {classification.severity.toUpperCase()}
        </span>
        <span className="px-3 py-1 text-xs font-medium rounded-full border border-neutral-700 text-neutral-300">
          {classification.errorCategory}
        </span>
        <span className="px-3 py-1 text-xs font-medium rounded-full border border-neutral-700 text-neutral-300">
          {classification.faultDomain.replace('_', ' ')}
        </span>
        {classification.provider && (
          <span className="px-3 py-1 text-xs font-medium rounded-full border border-neutral-700 text-neutral-300">
            {classification.provider}
          </span>
        )}
      </div>

      <ReportSection title="Root Cause" content={report.rootCause} />

      <ReportSection title="Evidence">
        <ul className="list-disc list-inside space-y-1 text-sm text-neutral-300">
          {report.evidence.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </ReportSection>

      <ReportSection title="Customer Impact" content={report.customerImpact} />

      <ReportSection title="Immediate Mitigation">
        <ul className="list-disc list-inside space-y-1 text-sm text-neutral-300">
          {report.mitigation.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </ReportSection>

      <ReportSection title="Reproduction Script">
        <pre className="bg-[#0a0a0a] border border-neutral-800 rounded-lg p-4 text-xs font-[family-name:var(--font-geist-mono)] text-neutral-300 overflow-x-auto whitespace-pre-wrap">
          {report.reproductionScript}
        </pre>
      </ReportSection>

      <ReportSection title="Escalation Notes" content={report.escalationNotes} />

      {report.similarIncidents && report.similarIncidents.length > 0 && (
        <ReportSection title="Similar Past Incidents">
          <ul className="space-y-2">
            {report.similarIncidents.map((incident) => (
              <li key={incident.id} className="text-sm text-neutral-300 border-b border-neutral-800 pb-2 last:border-0">
                <span className="text-neutral-500 text-xs">{incident.createdAt}</span>
                <span className="mx-2 text-neutral-600">|</span>
                <span className={`text-xs font-medium ${
                  incident.severity === 'high' || incident.severity === 'critical'
                    ? 'text-orange-400' : 'text-neutral-400'
                }`}>
                  {incident.severity.toUpperCase()}
                </span>
                <span className="mx-2 text-neutral-600">|</span>
                <span>{incident.errorMessage}</span>
              </li>
            ))}
          </ul>
        </ReportSection>
      )}
    </div>
  );
}

function ReportSection({
  title,
  content,
  children,
}: {
  title: string;
  content?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-[#141414] border border-neutral-800 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-neutral-200 mb-3">{title}</h3>
      {content && <p className="text-sm text-neutral-300">{content}</p>}
      {children}
    </div>
  );
}

function formatReportAsText(result: AnalysisResult): string {
  const { classification, report } = result;
  return `INCIDENT REPORT
================

Severity: ${classification.severity.toUpperCase()}
Category: ${classification.errorCategory}
Fault Domain: ${classification.faultDomain}
${classification.provider ? `Provider: ${classification.provider}` : ''}

ROOT CAUSE
${report.rootCause}

EVIDENCE
${report.evidence.map((e) => `- ${e}`).join('\n')}

CUSTOMER IMPACT
${report.customerImpact}

IMMEDIATE MITIGATION
${report.mitigation.map((m) => `- ${m}`).join('\n')}

REPRODUCTION SCRIPT
${report.reproductionScript}

ESCALATION NOTES
${report.escalationNotes}`;
}
