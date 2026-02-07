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

export interface IncidentClassification {
  errorCategory: '4xx' | '5xx' | 'timeout' | 'stream_abort' | 'unknown';
  faultDomain: 'customer' | 'openrouter' | 'upstream_provider';
  severity: 'low' | 'medium' | 'high' | 'critical';
  provider?: string;
  signals: string[];
}

export interface IncidentReport {
  rootCause: string;
  evidence: string[];
  customerImpact: string;
  mitigation: string[];
  reproductionScript: string;
  escalationNotes: string;
  similarIncidents?: SimilarIncident[];
}

export interface SimilarIncident {
  id: string;
  createdAt: string;
  errorMessage: string;
  faultDomain: string;
  severity: string;
}
