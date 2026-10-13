'use client';

import { AlertTriangle, FileText } from 'lucide-react';
import { ResearchResponse } from '@/lib/api';
import ExecutionTimeline from './ExecutionTimeline';

interface Props {
  result: ResearchResponse;
}

function MarkdownAnswer({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (s: string): React.ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, idx) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={idx}>{p.slice(2, -2)}</strong>
        : p
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    // Table: detect header separator row (---|---|---)
    if (i + 1 < lines.length && /^\s*\|?[\s\-|]+\|?\s*$/.test(lines[i + 1]) && line.trim().startsWith('|')) {
      const headers = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(h => h.trim());
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
        rows.push(cells);
        i++;
      }
      elements.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="border border-slate-600 bg-slate-700 px-3 py-1.5 text-left text-slate-200 font-semibold">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-slate-800' : 'bg-slate-750'}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-slate-600 px-3 py-1.5 text-slate-300">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-xl font-bold text-white mt-3 mb-1">{renderInline(line.slice(2))}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-bold text-white mt-3 mb-1">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold text-white mt-2 mb-1">{renderInline(line.slice(4))}</h3>);
    } else if (line.trim() === '') {
      elements.push(<br key={i} />);
    } else {
      elements.push(<p key={i} className="text-base text-white leading-relaxed">{renderInline(line)}</p>);
    }
    i++;
  }

  return <div>{elements}</div>;
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
          <MarkdownAnswer text={result.answer} />
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
