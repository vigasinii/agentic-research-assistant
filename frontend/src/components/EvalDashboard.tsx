'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Play, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { runEvals, getEvalResults, EvalSummary } from '@/lib/api';

function MetricRow({ label, value, isPercent = false }: { label: string; value: number; isPercent?: boolean }) {
  const display = isPercent ? `${(value * 100).toFixed(1)}%` : `${value.toFixed(0)}ms`;
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-medium text-white">{display}</span>
    </div>
  );
}

export default function EvalDashboard() {
  const [open, setOpen] = useState(false);
  const [evalKey, setEvalKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<EvalSummary | null>(null);

  async function handleRun() {
    if (!evalKey.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runEvals(evalKey);
      setSummary(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Eval run failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleFetch() {
    if (!evalKey.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getEvalResults(evalKey);
      setSummary(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch results');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Eval Dashboard</span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="p-4 bg-slate-900 space-y-4">
          <div className="flex gap-2">
            <input
              type="password"
              value={evalKey}
              onChange={e => setEvalKey(e.target.value)}
              placeholder="Eval API key"
              className="flex-1 bg-slate-800 border border-slate-700 focus:border-blue-500 focus:outline-none rounded px-3 py-2 text-sm text-white placeholder-slate-500 transition-colors"
            />
            <button
              onClick={handleRun}
              disabled={loading || !evalKey.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded transition-colors"
            >
              <Play size={12} />
              Run
            </button>
            <button
              onClick={handleFetch}
              disabled={loading || !evalKey.trim()}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded transition-colors"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Fetch
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">
              {error}
            </div>
          )}

          {summary && (
            <>
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Metrics</p>
                <MetricRow label="Precision@K" value={summary.precision_at_k} isPercent />
                <MetricRow label="Recall@K" value={summary.recall_at_k} isPercent />
                <MetricRow label="Abstention Accuracy" value={summary.abstention_accuracy} isPercent />
                <MetricRow label="Citation Validity" value={summary.citation_validity} isPercent />
                <MetricRow label="Avg Latency" value={summary.avg_latency_ms} />
              </div>

              {summary.cases && summary.cases.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-2 border-b border-slate-700">
                    Per-Case Results
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left text-slate-500 font-medium px-3 py-2">ID</th>
                          <th className="text-left text-slate-500 font-medium px-3 py-2">Scenario</th>
                          <th className="text-left text-slate-500 font-medium px-3 py-2">Result</th>
                          <th className="text-right text-slate-500 font-medium px-3 py-2">Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.cases.map((c, i) => (
                          <tr key={i} className="border-b border-slate-700 last:border-0">
                            <td className="px-3 py-2 text-slate-400">{c.question_id}</td>
                            <td className="px-3 py-2 text-slate-300">{c.scenario}</td>
                            <td className="px-3 py-2">
                              {c.passed ? (
                                <span className="flex items-center gap-1 text-green-400">
                                  <CheckCircle size={12} /> Pass
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-400">
                                  <XCircle size={12} /> Fail
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-400">{c.latency_ms}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
