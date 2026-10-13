'use client';

import { ExecutionStep } from '@/lib/api';

const STEP_CFG: Record<string, { dot: string; badge: string }> = {
  query_analysis: { dot: 'bg-sky-400',          badge: 'text-sky-400 bg-sky-500/10 border-sky-500/15' },
  retrieve:       { dot: 'bg-[#8B7CFF]',         badge: 'text-[#8B7CFF] bg-[#8B7CFF]/10 border-[#8B7CFF]/15' },
  grade:          { dot: 'bg-[#F2B86B]',          badge: 'text-[#F2B86B] bg-[#F2B86B]/10 border-[#F2B86B]/15' },
  rewrite:        { dot: 'bg-orange-400',          badge: 'text-orange-400 bg-orange-500/10 border-orange-500/15' },
  answer:         { dot: 'bg-[#42D6A4]',           badge: 'text-[#42D6A4] bg-[#42D6A4]/10 border-[#42D6A4]/15' },
  verify:         { dot: 'bg-violet-400',           badge: 'text-violet-400 bg-violet-500/10 border-violet-500/15' },
};

function getCfg(name: string) {
  const key = Object.keys(STEP_CFG).find(k => name.toLowerCase().includes(k));
  return key ? STEP_CFG[key] : { dot: 'bg-white/30', badge: 'text-[#9999AD]/60 bg-white/5 border-white/10' };
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
    <div className="px-4 py-4 space-y-3">
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
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className="relative grid grid-cols-[auto_1fr_auto] gap-3 items-start">
              {!isLast && (
                <div className="absolute left-[5px] top-4 w-px h-full bg-[#262638]" />
              )}
              <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-[#141420] ${cfg.dot}`} />
              <div className="min-w-0 pb-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.badge}`}>
                    {step.step_name}
                  </span>
                </div>
                {step.input_summary && (
                  <p className="text-[10px] text-[#9999AD]/40 leading-relaxed truncate">
                    <span className="text-[#9999AD]/25">in · </span>{step.input_summary}
                  </p>
                )}
                {step.output_summary && (
                  <p className="text-[10px] text-[#9999AD]/60 leading-relaxed truncate">
                    <span className="text-[#9999AD]/25">out · </span>{step.output_summary}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-[#9999AD]/35 font-mono mt-1 shrink-0">{fmtMs(step.latency_ms)}</span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 pt-2 border-t border-[#262638] text-[10px] text-[#9999AD]/40">
        <span>{retrievalIterations} retrieval iteration{retrievalIterations !== 1 ? 's' : ''}</span>
        <span className="text-[#262638]">·</span>
        <span>Total: <span className="text-[#9999AD]/70 font-medium">{fmtMs(totalLatencyMs)}</span></span>
      </div>
    </div>
  );
}
