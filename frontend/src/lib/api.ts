const BASE_URL = '/api';

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { cache: 'no-store' });
    if (!res.ok) return false;
    const body = await res.json();
    return body.status === 'ok';
  } catch {
    return false;
  }
}

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  size_bytes: number;
  chunk_count: number;
  uploaded_at: string;
}

export interface Citation {
  chunk_id: string;
  source_filename: string;
  page_number: number | null;
  excerpt: string;
}

export interface ExecutionStep {
  step_name: string;
  input_summary: string;
  output_summary: string;
  latency_ms: number;
}

export interface ResearchResponse {
  run_id: string;
  question: string;
  answer: string;
  citations: Citation[];
  abstained: boolean;
  abstention_reason: string | null;
  retrieval_iterations: number;
  execution_steps: ExecutionStep[];
  total_latency_ms: number;
}

export interface EvalSummary {
  precision_at_k: number;
  recall_at_k: number;
  abstention_accuracy: number;
  citation_validity: number;
  avg_latency_ms: number;
  cases: EvalCase[];
}

export interface EvalCase {
  question_id: string;
  scenario: string;
  passed: boolean;
  latency_ms: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail ?? body.message ?? msg;
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function uploadDocument(file: File): Promise<{ document_id: string; filename: string; chunk_count: number; message: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/documents/upload`, { method: 'POST', body: form });
  return handleResponse(res);
}

export async function getDocuments(): Promise<Document[]> {
  const res = await fetch(`${BASE_URL}/documents`);
  return handleResponse(res);
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/documents/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.detail ?? body.message ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
}

export async function askQuestion(question: string): Promise<ResearchResponse> {
  const res = await fetch(`${BASE_URL}/research`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  return handleResponse(res);
}

export async function runEvals(evalKey: string): Promise<EvalSummary> {
  const res = await fetch(`${BASE_URL}/evals/run`, {
    method: 'POST',
    headers: { 'X-Eval-Key': evalKey },
  });
  return handleResponse(res);
}

export async function getEvalResults(evalKey: string): Promise<EvalSummary> {
  const res = await fetch(`${BASE_URL}/evals/results`, {
    headers: { 'X-Eval-Key': evalKey },
  });
  return handleResponse(res);
}
