'use client';

import { ExecutionStep } from '@/lib/api';

const stepColors: Record<string, string> = {
  retrieve: 'bg-blue-900 text-blue-300 border-blue-700',
  grade: 'bg-yellow-900 text-yellow-300 border-yellow-700',
  rewrite: 'bg-orange-900 text-orange-300 border-orange-700',
  answer: 'bg-green-900 text-green-300 border-green-700',
  verify: 'bg-purple-900 text-purple-300 border-purple-700',
};

const dotColors: Record<string, string> = {
  retrieve: 'bg-blue-500',
  grade: 'bg-yellow-500',
  rewrite: 'bg-orange-500',
  answer: 'bg-green-500',
  verify: 'bg-purple-500',
};

function getStepColor(name: string): string {
  const key = Object.keys(stepColors).find(k => name.toLowerCase().includes(k));
  return key ? stepColors[key] : 'bg-slate-700 text-slate-300 border-slate-600';
}

function getDotColor(name: string): string {
  const key = Object.keys(dotColors).find(k => name.toLowerCase().includes(k));
  return key ? dotColors[key] : 'bg-slate-500';
}

interface Props {
  steps: ExecutionStep[];
  retrievalIterations: number;
  totalLatencyMs: number;
}

export default function ExecutionTimeline({ steps, retrievalIterations, totalLatencyMs }: Props) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Execution Timeline
      </h3>
      <div className="relative pl-6">
        {steps.map((step, i) => (
          <div key={i} className="relative mb-4 last:mb-0">
            <div className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full ${getDotColor(step.step_name)}`} />
            {i < steps.length - 1 && (
              <div className="absolute -left-[18px] top-4 w-px h-full bg-slate-700" />
            )}
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getStepColor(step.step_name)}`}>
                  {step.step_name}
                </span>
                <span className="ml-auto text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
                  {step.latency_ms}ms
                </span>
              </div>
              {step.input_summary && (
                <p className="text-xs text-slate-400 mb-1">
                  <span className="text-slate-500">In: </span>{step.input_summary}
                </p>
              )}
              {step.output_summary && (
                <p className="text-xs text-slate-300">
                  <span className="text-slate-500">Out: </span>{step.output_summary}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
        <span>Retrieval iterations: <span className="text-slate-300">{retrievalIterations}</span></span>
        <span>Total latency: <span className="text-slate-300">{totalLatencyMs}ms</span></span>
      </div>
    </div>
  );
}
