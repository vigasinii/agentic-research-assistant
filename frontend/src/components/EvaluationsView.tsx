'use client';

import { useState } from 'react';
import { Play, RefreshCw, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { runEvals, getEvalResults, EvalSummary } from '@/lib/api';

interface Props {
  onEvalResult: (summary: EvalSummary) => void;
}

interface MetricCardProps {
  label: string;
  description: string;
  value: number;
}

function MetricCard({ label, description, value }: MetricCardProps) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#42D6A4' : pct >= 50 ? '#F2B86B' : '#FF6B6B';
  const bg = pct >= 80 ? 'bg-[#42D6A4]/10 border-[#42D6A4]/20' : pct >= 50 ? 'bg-[#F2B86B]/10 border-[#F2B86B]/20' : 'bg-[#FF6B6B]/10 border-[#FF6B6B]/20';
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-[10px] font-semibold text-[#9999AD]/70 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold tabular-nums mb-1" style={{ color }}>{pct}%</p>
      <p className="text-[11px] text-[#9999AD]/60 leading-relaxed mb-3">{description}</p>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function EvaluationsView({ onEvalResult }: Props) {
  const [evalKey, setEvalKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  async function handleRun() {
    if (!evalKey.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const s = await runEvals(evalKey);
      setSummary(s);
      onEvalResult(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Eval run failed');
    } finally { setLoading(false); }
  }

  async function handleFetch() {
    if (!evalKey.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const s = await getEvalResults(evalKey);
      setSummary(s);
      onEvalResult(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch results');
    } finally { setLoading(false); }
  }

  const chartData = summary?.cases.map(c => ({
    name: c.question_id,
    latency: c.latency_ms,
    passed: c.passed ? 1 : 0,
    color: c.passed ? '#42D6A4' : '#FF6B6B',
  })) ?? [];

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#F4F4F7] mb-1">Evaluation Dashboard</h2>
        <p className="text-[14px] text-[#9999AD]">
          Measure retrieval quality, citation validity, and abstention accuracy against your document corpus.
        </p>
      </div>

      {/* API key + controls */}
      <div className="flex gap-2">
        <input
          type="password"
          value={evalKey}
          onChange={e => setEvalKey(e.target.value)}
          placeholder="Eval API key…"
          className="flex-1 bg-[#141420] border border-[#262638] focus:border-[#8B7CFF]/40 focus:outline-none rounded-xl px-4 py-2.5 text-[13px] text-[#F4F4F7] placeholder-[#9999AD]/40 transition-colors"
        />
        <button
          onClick={handleRun}
          disabled={loading || !evalKey.trim()}
          className="flex items-center gap-2 bg-[#8B7CFF] hover:bg-[#A69BFF] disabled:opacity-40 text-white text-[12px] font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-[#8B7CFF]/20"
        >
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
          Run Evals
        </button>
        <button
          onClick={handleFetch}
          disabled={loading || !evalKey.trim()}
          className="flex items-center gap-2 bg-[#141420] hover:bg-[#141420]/80 disabled:opacity-40 text-[#9999AD] hover:text-[#F4F4F7] text-[12px] font-medium px-4 py-2.5 rounded-xl border border-[#262638] transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Fetch
        </button>
      </div>

      {error && (
        <div className="text-[13px] text-[#FF6B6B]/80 bg-[#FF6B6B]/5 border border-[#FF6B6B]/15 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!summary && !loading && !error && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#141420] border border-[#262638] flex items-center justify-center">
            <BarChart3 size={24} className="text-[#8B7CFF]/60" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#F4F4F7]/70 mb-1">No evaluation data</p>
            <p className="text-[12px] text-[#9999AD]/60">Enter your eval API key and click Run Evals to get started.</p>
          </div>
        </div>
      )}

      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5"
        >
          {/* Metric cards 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Precision@K" description="Fraction of retrieved chunks that are relevant" value={summary.precision_at_k} />
            <MetricCard label="Recall@K" description="Fraction of relevant chunks that were retrieved" value={summary.recall_at_k} />
            <MetricCard label="Abstention Accuracy" description="Correctly refused unanswerable questions" value={summary.abstention_accuracy} />
            <MetricCard label="Citation Validity" description="Citations that match the source documents" value={summary.citation_validity} />
          </div>

          {/* Avg latency */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#141420] border border-[#262638] rounded-xl">
            <span className="text-[12px] text-[#9999AD]">Average latency</span>
            <span className="ml-auto text-[14px] font-bold text-[#F4F4F7] font-mono">{summary.avg_latency_ms.toFixed(0)} ms</span>
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-[#141420] border border-[#262638] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#9999AD]/50 uppercase tracking-widest mb-4">Per-case Latency (pass/fail)</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9999AD' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9999AD' }} axisLine={false} tickLine={false} unit="ms" />
                  <Tooltip
                    contentStyle={{ background: '#141420', border: '1px solid #262638', borderRadius: 8, fontSize: 11, color: '#F4F4F7' }}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  />
                  <Bar dataKey="latency" radius={[4,4,0,0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Cases table */}
          {summary.cases.length > 0 && (
            <div className="bg-[#141420] border border-[#262638] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#262638]">
                <p className="text-[10px] font-semibold text-[#9999AD]/50 uppercase tracking-widest">Test Results</p>
              </div>
              <div className="divide-y divide-[#262638]/60">
                {summary.cases.map((c, i) => (
                  <div key={i}>
                    <button
                      onClick={() => setExpandedCase(expandedCase === c.question_id ? null : c.question_id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                    >
                      {c.passed
                        ? <CheckCircle2 size={13} className="text-[#42D6A4] shrink-0" />
                        : <XCircle size={13} className="text-[#FF6B6B] shrink-0" />
                      }
                      <span className="text-[11px] font-mono text-[#9999AD]/60 shrink-0 w-20">{c.question_id}</span>
                      <span className="text-[12px] text-[#F4F4F7]/70 flex-1 truncate">{c.scenario}</span>
                      <span className="text-[11px] text-[#9999AD]/50 font-mono shrink-0">{c.latency_ms} ms</span>
                    </button>
                    {expandedCase === c.question_id && (
                      <div className="px-4 pb-3 pt-0">
                        <div className="bg-[#09090F] border border-[#262638]/60 rounded-lg px-3 py-2.5">
                          <p className="text-[11px] text-[#9999AD]/70 font-mono leading-relaxed">{c.scenario}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.passed ? 'bg-[#42D6A4]/10 text-[#42D6A4]' : 'bg-[#FF6B6B]/10 text-[#FF6B6B]'}`}>
                              {c.passed ? 'PASS' : 'FAIL'}
                            </span>
                            <span className="text-[10px] text-[#9999AD]/50 font-mono">{c.latency_ms} ms</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
