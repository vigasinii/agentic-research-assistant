'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Database, BarChart3, CheckCircle2, XCircle } from 'lucide-react';
import { Document, ResearchResponse, EvalSummary } from '@/lib/api';
import ExecutionTimeline from './ExecutionTimeline';

interface Props {
  open: boolean;
  onToggle: () => void;
  docs: Document[];
  result: ResearchResponse | null;
  evalSummary: EvalSummary | null;
  onSwitchToEvals: () => void;
}

function MetricChip({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'text-[#42D6A4]' : pct >= 50 ? 'text-[#F2B86B]' : 'text-[#FF6B6B]';
  const bar = pct >= 80 ? 'bg-[#42D6A4]' : pct >= 50 ? 'bg-[#F2B86B]' : 'bg-[#FF6B6B]';
  return (
    <div className="bg-white/[0.03] border border-[#262638] rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-[#9999AD]/70">{label}</span>
        <span className={`text-[12px] font-bold tabular-nums ${color}`}>{pct}%</span>
      </div>
      <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function RightPanel({ open, onToggle, docs, result, evalSummary, onSwitchToEvals }: Props) {
  const totalChunks = docs.reduce((s, d) => s + d.chunk_count, 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 300, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="shrink-0 flex flex-col border-l border-[#262638] bg-[#0E0E17] overflow-hidden relative"
          style={{ minWidth: 0 }}
        >
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Knowledge Base */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Database size={12} className="text-[#8B7CFF]" />
                <span className="text-[10px] font-semibold text-[#9999AD]/60 uppercase tracking-widest">Knowledge Base</span>
              </div>
              <div className="bg-[#141420] border border-[#262638] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#9999AD]">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1.5 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${docs.length > 0 ? 'bg-[#42D6A4]' : 'bg-[#9999AD]/30'}`} />
                    <span className={docs.length > 0 ? 'text-[#42D6A4]' : 'text-[#9999AD]/40'}>
                      {docs.length > 0 ? 'indexed' : 'empty'}
                    </span>
                  </span>
                </div>
                <div className="text-[11px] text-[#9999AD]/60">
                  {totalChunks.toLocaleString()} chunks indexed
                </div>
              </div>
            </section>

            {/* Research Process */}
            {result && result.execution_steps.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-0.5">
                    {[0,1,2].map(i => <div key={i} className="w-0.5 rounded-full bg-[#8B7CFF]/60" style={{ height: `${8 + i * 3}px` }} />)}
                  </div>
                  <span className="text-[10px] font-semibold text-[#9999AD]/60 uppercase tracking-widest">Research Process</span>
                </div>
                <div className="bg-[#141420] border border-[#262638] rounded-xl overflow-hidden">
                  <ExecutionTimeline
                    steps={result.execution_steps}
                    retrievalIterations={result.retrieval_iterations}
                    totalLatencyMs={result.total_latency_ms}
                  />
                </div>
              </section>
            )}

            {/* Evaluation Snapshot */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={12} className="text-[#8B7CFF]" />
                <span className="text-[10px] font-semibold text-[#9999AD]/60 uppercase tracking-widest">Eval Snapshot</span>
              </div>
              {evalSummary ? (
                <div className="space-y-1.5">
                  <MetricChip label="Precision@K" value={evalSummary.precision_at_k} />
                  <MetricChip label="Recall@K" value={evalSummary.recall_at_k} />
                  <MetricChip label="Abstention Acc." value={evalSummary.abstention_accuracy} />
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.02] border border-[#262638] rounded-lg">
                    <span className="text-[10px] text-[#9999AD]/60">Avg Latency</span>
                    <span className="text-[11px] font-medium text-[#F4F4F7]/70 font-mono">{evalSummary.avg_latency_ms.toFixed(0)} ms</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5">
                    <span className="text-[11px] text-[#9999AD]/60">{evalSummary.cases.filter(c => c.passed).length}/{evalSummary.cases.length} tests passed</span>
                    <div className="flex gap-1">
                      {evalSummary.cases.slice(0, 8).map((c, i) => (
                        c.passed
                          ? <CheckCircle2 key={i} size={10} className="text-[#42D6A4]" />
                          : <XCircle key={i} size={10} className="text-[#FF6B6B]" />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#141420] border border-[#262638] rounded-xl p-4 text-center space-y-3">
                  <p className="text-[12px] text-[#9999AD]/50">No evaluation data yet</p>
                  <button
                    onClick={onSwitchToEvals}
                    className="text-[11px] font-medium text-[#8B7CFF] hover:text-[#A69BFF] transition-colors"
                  >
                    Run Evaluations →
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Collapse toggle */}
          <button
            onClick={onToggle}
            className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 rounded-full bg-[#141420] border border-[#262638] flex items-center justify-center text-[#9999AD]/50 hover:text-[#F4F4F7] hover:border-[#8B7CFF]/40 transition-all duration-150 z-20"
          >
            <ChevronRight size={12} />
          </button>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
