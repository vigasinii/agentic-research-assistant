'use client';

import { AlertTriangle, FileText } from 'lucide-react';
import { ResearchResponse } from '@/lib/api';
import ExecutionTimeline from './ExecutionTimeline';

interface Props {
  result: ResearchResponse;
}

export default function AnswerPanel({ result }: Props) {
  return (
    <div className="space-y-4">
      {result.abstained && result.abstention_reason && (
        <div className="flex gap-3 bg-amber-900/20 border border-amber-700 rounded-lg p-4">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-400 mb-1">Abstained from answering</p>
            <p className="text-sm text-amber-300">{result.abstention_reason}</p>
          </div>
        </div>
      )}

      {!result.abstained && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <p className="text-sm font-semibold text-slate-400 mb-2">Answer</p>
          <p className="text-base text-white leading-relaxed whitespace-pre-wrap">{result.answer}</p>
        </div>
      )}

      {result.citations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Citations ({result.citations.length})
          </p>
          <div className="space-y-2">
            {result.citations.map((c, i) => (
              <div
                key={c.chunk_id ?? i}
                className="bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg p-3 transition-colors cursor-default"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <FileText size={12} className="text-slate-400" />
                  <span className="text-xs font-medium text-blue-400">{c.source_filename}</span>
                  {c.page_number != null && (
                    <span className="text-xs text-slate-500">p.{c.page_number}</span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{c.excerpt}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ExecutionTimeline
        steps={result.execution_steps}
        retrievalIterations={result.retrieval_iterations}
        totalLatencyMs={result.total_latency_ms}
      />
    </div>
  );
}
