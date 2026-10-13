'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Play, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { runEvals, getEvalResults, EvalSummary } from '@/lib/api';

function Gauge({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
  const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/40">{label}</span>
        <span className={`text-[12px] font-semibold tabular-nums ${color}`}>{pct}%</span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
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
    setLoading(true); setError(null);
    try { setSummary(await runEvals(evalKey)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Eval run failed'); }
    finally { setLoading(false); }
  }

  async function handleFetch() {
    if (!evalKey.trim() || loading) return;
    setLoading(true); setError(null);
    try { setSummary(await getEvalResults(evalKey)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to fetch results'); }
    finally { setLoading(false); }
  }

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.02] hover:bg-white/[0.035] transition-colors"
      >
        <span className="text-[11px] font-semibold text-white/35 uppercase tracking-widest">Eval Dashboard</span>
        {open
          ? <ChevronUp size={12} className="text-white/20" />
          : <ChevronDown size={12} className="text-white/20" />
        }
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-white/[0.01] border-t border-white/[0.05]">

          {/* Key input + actions */}
          <div className="flex gap-2">
            <input
              type="password"
              value={evalKey}
              onChange={e => setEvalKey(e.target.value)}
              placeholder="Eval API key…"
              className="flex-1 bg-white/[0.03] border border-white/[0.07] focus:border-indigo-500/40 focus:outline-none rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder-white/20 transition-colors"
            />
            <button
              onClick={handleRun}
              disabled={loading || !evalKey.trim()}
              className="flex items-center gap-1.5 bg-indigo-600/80 hover:bg-indigo-500/80 disabled:opacity-40 text-white text-[11px] font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Play size={11} />
              Run
            </button>
            <button
              onClick={handleFetch}
              disabled={loading || !evalKey.trim()}
              className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-40 text-white/60 hover:text-white/90 text-[11px] font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              Fetch
            </button>
          </div>

          {error && (
            <div className="text-[11px] text-red-300/70 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {summary && (
            <>
              {/* Metric gauges */}
              <div className="rounded-lg border border-white/[0.06] p-3 space-y-3">
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest mb-2">Metrics</p>
                <Gauge value={summary.precision_at_k}       label="Precision@K" />
                <Gauge value={summary.recall_at_k}          label="Recall@K" />
                <Gauge value={summary.abstention_accuracy}  label="Abstention Accuracy" />
                <Gauge value={summary.citation_validity}    label="Citation Validity" />
                <div className="pt-1 border-t border-white/[0.05] flex justify-between">
                  <span className="text-[11px] text-white/35">Avg Latency</span>
                  <span className="text-[11px] font-medium text-white/60">{summary.avg_latency_ms.toFixed(0)} ms</span>
                </div>
              </div>

              {/* Per-case table */}
              {summary.cases?.length > 0 && (
                <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                  <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-3 py-2 border-b border-white/[0.05]">
                    Per-case results
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-white/[0.05]">
                          {['ID', 'Scenario', 'Result', 'Latency'].map(h => (
                            <th key={h} className="text-left text-white/25 font-medium px-3 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {summary.cases.map((c, i) => (
                          <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                            <td className="px-3 py-2 text-white/35 font-mono">{c.question_id}</td>
                            <td className="px-3 py-2 text-white/60 max-w-[160px] truncate">{c.scenario}</td>
                            <td className="px-3 py-2">
                              {c.passed
                                ? <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={11} />Pass</span>
                                : <span className="flex items-center gap-1 text-red-400"><XCircle size={11} />Fail</span>
                              }
                            </td>
                            <td className="px-3 py-2 text-white/35 font-mono">{c.latency_ms} ms</td>
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
