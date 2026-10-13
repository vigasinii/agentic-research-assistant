'use client';

import { useState } from 'react';
import { AlertTriangle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { ResearchResponse } from '@/lib/api';
import ExecutionTimeline from './ExecutionTimeline';

interface Props { result: ResearchResponse; }

function renderInline(s: string): React.ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-white/95">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function MarkdownAnswer({ text }: { text: string }) {
  const lines = text.split('\n');
  const els: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (i + 1 < lines.length && /^\s*\|?[\s\-|]+\|?\s*$/.test(lines[i + 1]) && line.trim().startsWith('|')) {
      const headers = line.split('|').filter((_, x, a) => x > 0 && x < a.length - 1).map(h => h.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].split('|').filter((_, x, a) => x > 0 && x < a.length - 1).map(c => c.trim()));
        i++;
      }
      els.push(
        <div key={`t${i}`} className="overflow-x-auto my-4 rounded-lg border border-white/[0.06]">
          <table className="min-w-full text-[13px]">
            <thead className="bg-white/[0.03]">
              <tr>{headers.map((h, hi) => <th key={hi} className="px-3 py-2 text-left text-white/60 font-semibold border-b border-white/[0.06]">{renderInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-white/[0.015]'}>
                  {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-white/75 border-b border-white/[0.04] last-of-type:border-0">{renderInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith('# '))       els.push(<h1 key={i} className="text-[17px] font-bold text-white mt-4 mb-2 leading-snug">{renderInline(line.slice(2))}</h1>);
    else if (line.startsWith('## ')) els.push(<h2 key={i} className="text-[15px] font-semibold text-white/90 mt-4 mb-1.5 leading-snug">{renderInline(line.slice(3))}</h2>);
    else if (line.startsWith('### '))els.push(<h3 key={i} className="text-[13px] font-semibold text-white/80 mt-3 mb-1">{renderInline(line.slice(4))}</h3>);
    else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1];
      const content = line.replace(/^\d+\.\s/, '');
      els.push(
        <div key={i} className="flex gap-2.5 my-1.5">
          <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400 mt-0.5">{num}</span>
          <p className="text-[14px] text-white/80 leading-relaxed flex-1">{renderInline(content)}</p>
        </div>
      );
    }
    else if (line.trim() === '') els.push(<div key={i} className="h-1" />);
    else els.push(<p key={i} className="text-[14px] text-white/80 leading-relaxed my-1">{renderInline(line)}</p>);
    i++;
  }

  return <div className="space-y-0.5">{els}</div>;
}

export default function AnswerPanel({ result }: Props) {
  const [citOpen, setCitOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);

  return (
    <div className="space-y-3">

      {/* Abstention warning */}
      {result.abstained && result.abstention_reason && (
        <div className="flex gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl p-4">
          <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-semibold text-amber-400 mb-1 uppercase tracking-wide">Abstained</p>
            <p className="text-[13px] text-amber-300/80 leading-relaxed">{result.abstention_reason}</p>
          </div>
        </div>
      )}

      {/* Answer card */}
      {!result.abstained && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          {/* Accent bar + label */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05] bg-white/[0.015]">
            <div className="w-1 h-3.5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500" />
            <span className="text-[10px] font-semibold text-white/35 uppercase tracking-widest">Answer</span>
          </div>
          <div className="px-4 py-4">
            <MarkdownAnswer text={result.answer} />
          </div>
        </div>
      )}

      {/* Citations */}
      {result.citations.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] overflow-hidden">
          <button
            onClick={() => setCitOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.035] transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText size={12} className="text-white/30" />
              <span className="text-[11px] font-medium text-white/50">
                {result.citations.length} citation{result.citations.length !== 1 ? 's' : ''}
              </span>
            </div>
            {citOpen ? <ChevronUp size={12} className="text-white/25" /> : <ChevronDown size={12} className="text-white/25" />}
          </button>

          {citOpen && (
            <div className="divide-y divide-white/[0.04]">
              {result.citations.map((c, i) => (
                <div key={c.chunk_id ?? i} className="px-4 py-3 bg-white/[0.01] hover:bg-white/[0.025] transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-indigo-400/90">{c.source_filename}</span>
                    {c.page_number != null && (
                      <span className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">p. {c.page_number}</span>
                    )}
                  </div>
                  <p className="text-[12px] text-white/45 leading-relaxed line-clamp-3 font-mono">{c.excerpt}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Execution timeline */}
      <div className="rounded-xl border border-white/[0.07] overflow-hidden">
        <button
          onClick={() => setTimelineOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.035] transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {result.execution_steps.slice(0, 5).map((_, i) => (
                <div key={i} className="w-1 h-3 rounded-full bg-indigo-500/40" style={{ height: `${8 + (i % 3) * 4}px` }} />
              ))}
            </div>
            <span className="text-[11px] font-medium text-white/50">
              {(result.total_latency_ms / 1000).toFixed(2)}s · {result.execution_steps.length} steps
            </span>
          </div>
          {timelineOpen ? <ChevronUp size={12} className="text-white/25" /> : <ChevronDown size={12} className="text-white/25" />}
        </button>

        {timelineOpen && (
          <ExecutionTimeline
            steps={result.execution_steps}
            retrievalIterations={result.retrieval_iterations}
            totalLatencyMs={result.total_latency_ms}
          />
        )}
      </div>
    </div>
  );
}
