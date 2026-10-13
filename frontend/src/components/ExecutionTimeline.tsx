'use client';

import { ExecutionStep } from '@/lib/api';

const STEP_CFG: Record<string, { dot: string; badge: string }> = {
  query_analysis: { dot: 'bg-sky-400',     badge: 'text-sky-400 bg-sky-500/10 border-sky-500/15' },
  retrieve:       { dot: 'bg-indigo-400',  badge: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/15' },
  grade:          { dot: 'bg-amber-400',   badge: 'text-amber-400 bg-amber-500/10 border-amber-500/15' },
  rewrite:        { dot: 'bg-orange-400',  badge: 'text-orange-400 bg-orange-500/10 border-orange-500/15' },
  answer:         { dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15' },
  verify:         { dot: 'bg-violet-400',  badge: 'text-violet-400 bg-violet-500/10 border-violet-500/15' },
};

function getCfg(name: string) {
  const key = Object.keys(STEP_CFG).find(k => name.toLowerCase().includes(k));
  return key ? STEP_CFG[key] : { dot: 'bg-white/30', badge: 'text-white/50 bg-white/5 border-white/10' };
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

interface Props {
  steps: ExecutionStep[];
  retrievalIterations: number;
  totalLatencyMs: number;
}

export default function ExecutionTimeline({ steps, retrievalIterations, totalLatencyMs }: Props) {
  const total = steps.reduce((s, x) => s + x.latency_ms, 0) || 1;

  return (
    <div className="px-4 py-4 space-y-3 bg-white/[0.01]">

      {/* Progress bar */}
      <div className="flex gap-0.5 h-1 rounded-full overflow-hidden mb-4">
        {steps.map((step, i) => {
          const cfg = getCfg(step.step_name);
          const pct = (step.latency_ms / total) * 100;
          return (
            <div
              key={i}
              title={`${step.step_name}: ${fmtMs(step.latency_ms)}`}
              style={{ width: `${pct}%` }}
              className={`${cfg.dot} opacity-60 hover:opacity-100 transition-opacity cursor-default rounded-full`}
            />
          );
        })}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, i) => {
          const cfg = getCfg(step.step_name);
          return (
            <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-3 items-start">
              <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
                    {step.step_name}
                  </span>
                </div>
                {step.input_summary && (
                  <p className="text-[11px] text-white/30 leading-relaxed truncate">
                    <span className="text-white/20">in · </span>{step.input_summary}
                  </p>
                )}
                {step.output_summary && (
                  <p className="text-[11px] text-white/50 leading-relaxed truncate">
                    <span className="text-white/20">out · </span>{step.output_summary}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-white/25 font-mono mt-1 shrink-0">{fmtMs(step.latency_ms)}</span>
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="flex items-center gap-4 pt-2 border-t border-white/[0.05] text-[11px] text-white/30">
        <span>{retrievalIterations} retrieval iteration{retrievalIterations !== 1 ? 's' : ''}</span>
        <span className="text-white/10">·</span>
        <span>Total: <span className="text-white/50 font-medium">{fmtMs(totalLatencyMs)}</span></span>
      </div>
    </div>
  );
}
